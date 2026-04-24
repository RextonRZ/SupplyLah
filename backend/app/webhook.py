"""Twilio WhatsApp webhook receiver and mock chat endpoint."""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Form, Header, HTTPException, Request
from fastapi.responses import PlainTextResponse, StreamingResponse

from app.agents.orchestrator import handle_incoming_message, _msg_collector
from app.config import get_settings
from app.models.schemas import IncomingMessage, MessageType
from app.services import log_stream
from app.services.twilio_service import send_whatsapp_message

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────
# Real Twilio webhook
# ─────────────────────────────────────────

@router.post("/webhook/twilio", response_class=PlainTextResponse)
async def twilio_webhook(
    request: Request,
    From: str = Form(default=""),
    Body: str = Form(default=""),
    MediaUrl0: str = Form(default=""),
    MediaContentType0: str = Form(default=""),
    NumMedia: str = Form(default="0"),
):
    """Receive inbound WhatsApp messages from Twilio and route to agent pipeline."""
    settings = get_settings()

    from_number = From.replace("whatsapp:", "")

    # Determine message type
    if int(NumMedia) > 0 and MediaUrl0:
        ct = MediaContentType0.lower()
        if "audio" in ct or "ogg" in ct:
            msg_type = MessageType.AUDIO
        elif "image" in ct:
            msg_type = MessageType.IMAGE
        else:
            msg_type = MessageType.TEXT
    else:
        msg_type = MessageType.TEXT

    if settings.use_mock_whatsapp:
        # Mock path: process synchronously (no real Twilio timeout to worry about)
        try:
            reply = await handle_incoming_message(
                from_number=from_number,
                message_type=msg_type,
                text_content=Body or None,
                media_url=MediaUrl0 or None,
                merchant_id=settings.default_merchant_id,
            )
            await send_whatsapp_message(from_number, reply)
        except Exception as exc:
            logger.error("Webhook processing error: %s", exc, exc_info=True)
        return PlainTextResponse(content="OK")

    # Real Twilio path: Twilio has a 15-second webhook timeout but AI processing
    # can take longer. Return empty TwiML immediately, then send reply via outbound API.
    import asyncio

    async def _process_and_reply():
        try:
            reply = await handle_incoming_message(
                from_number=from_number,
                message_type=msg_type,
                text_content=Body or None,
                media_url=MediaUrl0 or None,
                merchant_id=settings.default_merchant_id,
            )
            await send_whatsapp_message(from_number, reply)
        except Exception as exc:
            logger.error("Webhook background error: %s", exc, exc_info=True)

    asyncio.create_task(_process_and_reply())
    # Return empty TwiML immediately so Twilio doesn't time out
    return PlainTextResponse(
        content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        media_type="application/xml",
    )


# ─────────────────────────────────────────
# SSE log stream for demo UI
# ─────────────────────────────────────────

@router.get("/api/session-logs/{session_id}")
async def session_logs(session_id: str):
    """Stream real agent log lines to the demo UI via Server-Sent Events."""
    queue = log_stream.register(session_id)

    async def event_stream():
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=120.0)
                    if msg == log_stream.DONE:
                        yield f"data: {json.dumps({'type': 'done'})}\n\n"
                        break
                    yield f"data: {msg}\n\n"  # already serialised JSON
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            log_stream.unregister(session_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─────────────────────────────────────────
# Mock chat endpoint (demo UI backend)
# ─────────────────────────────────────────

@router.post("/webhook/mock-chat")
async def mock_chat(
    payload: IncomingMessage,
    x_session_id: str = Header(default=""),
):
    """Simulate a WhatsApp message for the demo UI without real Twilio credentials."""
    settings = get_settings()

    collector: list[str] = []
    token = _msg_collector.set(collector)
    if x_session_id:
        log_stream.set_session(x_session_id)
    try:
        await handle_incoming_message(
            from_number=payload.from_number,
            message_type=payload.message_type,
            text_content=payload.text_content,
            media_url=payload.media_url,
            merchant_id=payload.merchant_id or settings.default_merchant_id,
        )
    except Exception as exc:
        logger.error("Mock chat error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        _msg_collector.reset(token)
        if x_session_id:
            log_stream.close(x_session_id)

    return {"replies": collector, "from_number": payload.from_number}
