"""Per-request SSE log streaming for the demo chat."""
from __future__ import annotations

import asyncio
import json
from contextvars import ContextVar
from typing import Optional

# session_id → asyncio.Queue of pre-serialised JSON strings
_sessions: dict[str, asyncio.Queue[str]] = {}

_current_session: ContextVar[Optional[str]] = ContextVar("_current_session", default=None)

DONE = "__DONE__"


def register(session_id: str) -> asyncio.Queue[str]:
    q: asyncio.Queue[str] = asyncio.Queue(maxsize=200)
    _sessions[session_id] = q
    return q


def unregister(session_id: str) -> None:
    _sessions.pop(session_id, None)


def set_session(session_id: str) -> None:
    _current_session.set(session_id)


def _push(payload: str) -> None:
    sid = _current_session.get()
    if sid and sid in _sessions:
        try:
            _sessions[sid].put_nowait(payload)
        except asyncio.QueueFull:
            pass


def emit(message: str) -> None:
    """Push a log line (shown in the AI Reasoning panel)."""
    _push(json.dumps({"type": "log", "message": message}))


def emit_message(text: str) -> None:
    """Push an agent chat message (shown in the WhatsApp chat immediately)."""
    _push(json.dumps({"type": "message", "text": text}))


def close(session_id: str) -> None:
    """Signal the SSE stream to close cleanly."""
    if session_id in _sessions:
        try:
            _sessions[session_id].put_nowait(DONE)
        except asyncio.QueueFull:
            pass
