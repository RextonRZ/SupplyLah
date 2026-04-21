"""Twilio WhatsApp webhook receiver and mock chat endpoint."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import PlainTextResponse

from app.agents.orchestrator import handle_incoming_message
from app.config import get_settings
from app.models.schemas import IncomingMessage, MessageType
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

    try:
        reply = await handle_incoming_message(
            from_number=from_number,
            message_type=msg_type,
            text_content=Body or None,
            media_url=MediaUrl0 or None,
            merchant_id=settings.default_merchant_id,
        )

        if not settings.use_mock_whatsapp:
            # Twilio TwiML response for auto-reply
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?><Response><Message>{reply}</Message></Response>"""
            return PlainTextResponse(content=twiml, media_type="application/xml")
        else:
            await send_whatsapp_message(from_number, reply)
            return PlainTextResponse(content="OK")

    except Exception as exc:
        logger.error("Webhook processing error: %s", exc, exc_info=True)
        return PlainTextResponse(content="OK")  # Always 200 to Twilio


# ─────────────────────────────────────────
# Mock chat endpoint (demo UI backend)
# ─────────────────────────────────────────

@router.post("/webhook/mock-chat")
async def mock_chat(payload: IncomingMessage):
    """Simulate a WhatsApp message for the demo UI without real Twilio credentials."""
    settings = get_settings()

    try:
        reply = await handle_incoming_message(
            from_number=payload.from_number,
            message_type=payload.message_type,
            text_content=payload.text_content,
            media_url=payload.media_url,
            merchant_id=payload.merchant_id or settings.default_merchant_id,
        )
        return {"reply": reply, "from_number": payload.from_number}
    except Exception as exc:
        logger.error("Mock chat error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
