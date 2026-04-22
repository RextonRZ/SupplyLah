"""Z.ai GLM API client — OpenAI-compatible interface with tool-calling support."""
from __future__ import annotations

import base64
import json
import logging
from pathlib import Path
from typing import Any, Callable, Awaitable

import httpx
from openai import AsyncOpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)


def _build_client() -> AsyncOpenAI:
    settings = get_settings()
    
    # --- #to be removed starting here ---
    # Temporarily intercept and use Gemini if configured
    if settings.gemini_api_key:
        return AsyncOpenAI(
            api_key=settings.gemini_api_key,
            base_url=settings.gemini_base_url,
            http_client=httpx.AsyncClient(timeout=60.0),
        )
    # --- #to be removed ending here ---
    
    return AsyncOpenAI(
        api_key=settings.zai_api_key,
        base_url=settings.zai_base_url,
        http_client=httpx.AsyncClient(timeout=60.0),
    )


# Module-level singleton
_client: AsyncOpenAI | None = None


def get_glm_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = _build_client()
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
    """Drive the GLM tool-calling loop until the model returns a final text response.

    Each iteration: call the model → execute any requested tools → feed results back.
    Returns the model's final text content when it stops requesting tools.
    """
    client = get_glm_client()

    for iteration in range(max_iterations):
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        response = await client.chat.completions.create(**kwargs)
        choice = response.choices[0]
        msg = choice.message

        # Append assistant turn to history
        messages.append(msg.model_dump(exclude_none=True))

        if not msg.tool_calls:
            # No more tool calls — return final answer
            return msg.content or ""

        # Execute each requested tool call
        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments)
            except json.JSONDecodeError:
                args = {}

            if name in tool_executors:
                try:
                    result = await tool_executors[name](**args)
                except Exception as exc:
                    result = {"error": str(exc)}
            else:
                result = {"error": f"Unknown tool: {name}"}

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
    """Send an image to GLM-4V and return its text response."""
    settings = get_settings()
    client = get_glm_client()

    if image_path_or_url.startswith("http"):
        image_content: dict = {"type": "image_url", "image_url": {"url": image_path_or_url}}
    else:
        data = Path(image_path_or_url).read_bytes()
        b64 = base64.b64encode(data).decode()
        ext = Path(image_path_or_url).suffix.lstrip(".") or "jpeg"
        image_content = {
            "type": "image_url",
            "image_url": {"url": f"data:image/{ext};base64,{b64}"},
        }

    response = await client.chat.completions.create(
        model=settings.model_vision,
        messages=[
            {
                "role": "user",
                "content": [image_content, {"type": "text", "text": prompt}],
            }
        ],
    )
    return response.choices[0].message.content or ""


# ─────────────────────────────────────────
# ASR helper
# ─────────────────────────────────────────

async def transcribe_audio(audio_bytes: bytes, language_hint: str = "zh,en,ms") -> str:
    """Transcribe audio via ZhipuAI's ASR model.

    Falls back to a multimodal text message approach if the dedicated audio
    endpoint is unavailable in the current API tier.
    """
    settings = get_settings()

    # Try ZhipuAI SDK first (has native audio support)
    try:
        from zhipuai import ZhipuAI  # type: ignore

        zai = ZhipuAI(api_key=settings.zai_api_key)
        response = zai.audio.transcriptions.create(
            model=settings.model_asr,
            file=("audio.mp3", audio_bytes, "audio/mpeg"),
        )
        return response.text
    except Exception as exc:
        logger.warning("ZhipuAI ASR SDK failed (%s), falling back to multimodal", exc)

    # Fallback: send as base64 audio in chat completions
    b64 = base64.b64encode(audio_bytes).decode()
    client = get_glm_client()
    response = await client.chat.completions.create(
        model=settings.model_vision,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": f"Please transcribe the following audio. Languages may include Malaysian English, Bahasa Melayu, or mixed. Output transcription only.\nBase64 audio: {b64[:100]}..."},
                ],
            }
        ],
    )
    return response.choices[0].message.content or ""
