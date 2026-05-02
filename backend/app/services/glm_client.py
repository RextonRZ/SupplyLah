"""Google Gemini client via OpenAI-compatible endpoint.

Uses the openai SDK pointed at Gemini's OpenAI-compatible base URL so the
rest of the codebase (tools, message format) stays unchanged.
ASR is handled separately by Groq Whisper (transcription_service.py).
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
from pathlib import Path
from typing import Any, Callable, Awaitable

from openai import AsyncOpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)

# Module-level singleton
_client: AsyncOpenAI | None = None


def get_glm_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        settings = get_settings()
        _client = AsyncOpenAI(
            api_key=settings.gemini_api_key,
            base_url=settings.gemini_base_url,
            timeout=120.0,
            max_retries=0,
        )
    return _client


# ─────────────────────────────────────────
# Core agentic tool-calling loop
# ─────────────────────────────────────────

async def run_agent_loop(
    model: str,
    messages: list[dict],
    tools: list[dict],
    tool_executors: dict[str, Callable[..., Awaitable[Any]]],
    max_iterations: int = 10,
) -> str:
    """Drive the Gemini tool-calling loop until the model returns a final text response."""
    client = get_glm_client()

    for iteration in range(max_iterations):
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": 8000,
        }
        if tools:
            kwargs["tools"] = tools

        for attempt in range(2):
            try:
                response = await client.chat.completions.create(**kwargs)
                break
            except Exception as exc:
                if attempt < 1:
                    logger.warning("Gemini transient error (attempt %d/2): %s — retrying in 10s", attempt + 1, exc)
                    await asyncio.sleep(10)
                else:
                    raise

        choice = response.choices[0]
        msg = choice.message

        # Append assistant turn to history
        assistant_msg: dict = {"role": "assistant", "content": msg.content}
        if msg.tool_calls:
            assistant_msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in msg.tool_calls
            ]
        messages.append(assistant_msg)

        if not msg.tool_calls:
            return msg.content or ""

        # Execute each requested tool call and feed results back
        for tc in msg.tool_calls:
            if tc.function.name in tool_executors:
                try:
                    args = json.loads(tc.function.arguments)
                    result = await tool_executors[tc.function.name](**args)
                except Exception as exc:
                    result = {"error": str(exc)}
            else:
                result = {"error": f"Unknown tool: {tc.function.name}"}

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result, ensure_ascii=False),
            })

        logger.debug("Agent loop iteration %d complete", iteration + 1)

    raise RuntimeError("Agent loop exceeded max iterations without reaching a final answer")


# ─────────────────────────────────────────
# Vision helper
# ─────────────────────────────────────────

async def describe_image(image_path_or_url: str, prompt: str) -> str:
    """Send an image to Gemini vision and return its text response."""
    settings = get_settings()
    client = get_glm_client()

    if image_path_or_url.startswith("http") or image_path_or_url.startswith("data:"):
        image_block: dict = {
            "type": "image_url",
            "image_url": {"url": image_path_or_url},
        }
    else:
        data = Path(image_path_or_url).read_bytes()
        b64 = base64.b64encode(data).decode()
        ext = Path(image_path_or_url).suffix.lstrip(".") or "jpeg"
        media_type = f"image/{ext}" if ext in ("png", "jpg", "jpeg", "gif", "webp") else "image/jpeg"
        image_block = {
            "type": "image_url",
            "image_url": {"url": f"data:{media_type};base64,{b64}"},
        }

    response = await client.chat.completions.create(
        model=settings.model_vision,
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [image_block, {"type": "text", "text": prompt}],
            }
        ],
    )
    return response.choices[0].message.content or ""


# ─────────────────────────────────────────
# ASR helper — delegates to Groq Whisper
# ─────────────────────────────────────────

async def transcribe_audio(audio_bytes: bytes, _language_hint: str = "zh,en,ms") -> str:
    """Transcribe audio via Groq Whisper (faster and more accurate than vision-based ASR)."""
    from app.services.transcription_service import transcribe_audio as groq_transcribe
    return await groq_transcribe(audio_bytes)
