"""Ilmu.ai GLM API client — Anthropic-compatible interface with tool-calling support."""
from __future__ import annotations

import asyncio
import base64
import json
import logging
from pathlib import Path
from typing import Any, Callable, Awaitable

import anthropic

from app.config import get_settings

logger = logging.getLogger(__name__)


def _build_client() -> anthropic.AsyncAnthropic:
    settings = get_settings()
    return anthropic.AsyncAnthropic(
        api_key=settings.ilmu_api_key,
        base_url=settings.ilmu_base_url,
        timeout=120.0,
        max_retries=0,  # don't silently retry on timeout — fail fast after 60s
    )


# Module-level singleton
_client: anthropic.AsyncAnthropic | None = None


def get_glm_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = _build_client()
    return _client


# ─────────────────────────────────────────
# Core agentic tool-calling loop
# ─────────────────────────────────────────

def _convert_openai_tools_to_anthropic(tools: list[dict]) -> list[dict]:
    """Convert OpenAI-format tool definitions to Anthropic format."""
    anthropic_tools = []
    for tool in tools:
        func = tool.get("function", tool)
        anthropic_tools.append({
            "name": func["name"],
            "description": func.get("description", ""),
            "input_schema": func.get("parameters", {"type": "object", "properties": {}}),
        })
    return anthropic_tools


def _convert_messages_for_anthropic(messages: list[dict]) -> tuple[str, list[dict]]:
    """Split messages into system prompt + Anthropic-format messages.

    Anthropic requires system as a separate parameter, and messages must
    alternate user/assistant with no consecutive same-role turns.
    Tool-result messages use role=user with tool_result content blocks.
    """
    system = ""
    converted: list[dict] = []

    for msg in messages:
        role = msg.get("role")

        if role == "system":
            system = msg.get("content", "")
            continue

        if role == "tool":
            # Anthropic expects tool results as user messages with tool_result blocks
            content = msg.get("content", "")
            tool_call_id = msg.get("tool_call_id", "")
            # Find tool name from preceding assistant message (not used in output
            # but kept for debugging clarity)
            converted.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": tool_call_id,
                    "content": content,
                }],
            })
            continue

        if role == "assistant":
            content = msg.get("content")
            tool_calls = msg.get("tool_calls")

            if tool_calls:
                blocks = []
                if content:
                    blocks.append({"type": "text", "text": content})
                for tc in tool_calls:
                    func = tc.get("function", {})
                    try:
                        args = json.loads(func.get("arguments", "{}"))
                    except json.JSONDecodeError:
                        args = {}
                    blocks.append({
                        "type": "tool_use",
                        "id": tc.get("id", ""),
                        "name": func.get("name", ""),
                        "input": args,
                    })
                converted.append({"role": "assistant", "content": blocks})
            else:
                if isinstance(content, list):
                    converted.append({"role": "assistant", "content": content})
                else:
                    converted.append({"role": "assistant", "content": content or ""})
            continue

        # user role
        content = msg.get("content")
        if isinstance(content, list):
            converted.append({"role": "user", "content": content})
        else:
            converted.append({"role": "user", "content": content or ""})

    # Ensure messages alternate user/assistant — merge consecutive same-role
    merged: list[dict] = []
    for msg in converted:
        if merged and merged[-1]["role"] == msg["role"]:
            # Merge content
            prev_content = merged[-1]["content"]
            curr_content = msg["content"]
            if isinstance(prev_content, list) and isinstance(curr_content, list):
                prev_content.extend(curr_content)
            elif isinstance(prev_content, list):
                prev_content.append({"type": "text", "text": curr_content})
            elif isinstance(curr_content, list):
                merged[-1]["content"] = [{"type": "text", "text": prev_content}] + curr_content
            else:
                merged[-1]["content"] = prev_content + "\n" + curr_content
        else:
            merged.append(msg)

    return system, merged


async def run_agent_loop(
    model: str,
    messages: list[dict],
    tools: list[dict],
    tool_executors: dict[str, Callable[..., Awaitable[Any]]],
    max_iterations: int = 10,
) -> str:
    """Drive the GLM tool-calling loop until the model returns a final text response.

    Each iteration: call the model → execute any requested tools → feed results back.
    Returns the model's final text content when it stops requesting tools.
    """
    client = get_glm_client()
    anthropic_tools = _convert_openai_tools_to_anthropic(tools) if tools else []

    for iteration in range(max_iterations):
        system, anthropic_msgs = _convert_messages_for_anthropic(messages)

        kwargs: dict[str, Any] = {
            "model": model,
            "messages": anthropic_msgs,
            "max_tokens": 8000,
        }
        if system:
            kwargs["system"] = system
        if anthropic_tools:
            kwargs["tools"] = anthropic_tools

        # Retry once on transient 5xx errors with a meaningful backoff.
        # ilmu.ai 504s suggest retry_after=120 but we cap at 20s for demo responsiveness.
        for attempt in range(2):
            try:
                response = await client.messages.create(**kwargs)
                break
            except anthropic.InternalServerError as exc:
                if attempt < 1:
                    logger.warning("ilmu.ai transient error (attempt %d/2): %s — retrying in 15s", attempt + 1, exc)
                    await asyncio.sleep(15)
                else:
                    raise

        # Convert Anthropic response back to OpenAI-like format for the message history
        text_parts = []
        tool_use_blocks = []
        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_use_blocks.append(block)

        # Build assistant message in OpenAI format for history tracking
        assistant_msg: dict = {"role": "assistant", "content": "\n".join(text_parts) if text_parts else None}
        if tool_use_blocks:
            assistant_msg["tool_calls"] = [
                {
                    "id": tb.id,
                    "type": "function",
                    "function": {
                        "name": tb.name,
                        "arguments": json.dumps(tb.input, ensure_ascii=False),
                    },
                }
                for tb in tool_use_blocks
            ]
        messages.append(assistant_msg)

        if not tool_use_blocks:
            return "\n".join(text_parts) or ""

        # Execute each requested tool call
        for tb in tool_use_blocks:
            if tb.name in tool_executors:
                try:
                    result = await tool_executors[tb.name](**tb.input)
                except Exception as exc:
                    result = {"error": str(exc)}
            else:
                result = {"error": f"Unknown tool: {tb.name}"}

            messages.append({
                "role": "tool",
                "tool_call_id": tb.id,
                "content": json.dumps(result, ensure_ascii=False),
            })

        logger.debug("Agent loop iteration %d complete", iteration + 1)

    raise RuntimeError("Agent loop exceeded max iterations without reaching a final answer")


# ─────────────────────────────────────────
# Vision helper
# ─────────────────────────────────────────

async def describe_image(image_path_or_url: str, prompt: str) -> str:
    """Send an image to the vision model and return its text response."""
    settings = get_settings()
    client = get_glm_client()

    if image_path_or_url.startswith("http"):
        image_content: dict = {
            "type": "image",
            "source": {
                "type": "url",
                "url": image_path_or_url,
            },
        }
    else:
        data = Path(image_path_or_url).read_bytes()
        b64 = base64.b64encode(data).decode()
        ext = Path(image_path_or_url).suffix.lstrip(".") or "jpeg"
        media_type = f"image/{ext}" if ext in ("png", "jpg", "jpeg", "gif", "webp") else "image/jpeg"
        image_content = {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": b64,
            },
        }

    response = await client.messages.create(
        model=settings.model_vision,
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [image_content, {"type": "text", "text": prompt}],
            }
        ],
    )
    return next((b.text for b in response.content if b.type == "text"), "")


# ─────────────────────────────────────────
# ASR helper
# ─────────────────────────────────────────

async def transcribe_audio(audio_bytes: bytes, _language_hint: str = "zh,en,ms") -> str:
    """Transcribe audio via the model's multimodal capabilities.

    Falls back to a multimodal text message approach if a dedicated audio
    endpoint is unavailable.
    """
    settings = get_settings()
    client = get_glm_client()

    b64 = base64.b64encode(audio_bytes).decode()
    response = await client.messages.create(
        model=settings.model_vision,
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Please transcribe the following audio. Languages may include "
                            "Malaysian English, Bahasa Melayu, or mixed. Output transcription only."
                        ),
                    },
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "audio/mpeg",
                            "data": b64,
                        },
                    },
                ],
            }
        ],
    )
    return next((b.text for b in response.content if b.type == "text"), "")
