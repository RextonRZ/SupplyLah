"""Twilio WhatsApp messaging — real client with mock fallback."""
from __future__ import annotations

import logging
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


async def send_whatsapp_message(to_number: str, body: str) -> Optional[str]:
    """Send a WhatsApp message. Returns message SID or None on mock."""
    settings = get_settings()

    if settings.use_mock_whatsapp:
        logger.info("[MOCK WhatsApp → %s]\n%s", to_number, body)
        return "MOCK_SID"

    try:
        from twilio.rest import Client  # type: ignore

        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        to = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
        msg = client.messages.create(
            from_=settings.twilio_whatsapp_from,
            to=to,
            body=body,
        )
        logger.info("WhatsApp sent to %s, SID=%s", to_number, msg.sid)
        return msg.sid
    except Exception as exc:
        logger.error("Twilio send failed: %s", exc)
        return None


async def download_twilio_media(media_url: str) -> bytes:
    """Download a Twilio media attachment (voice note / image)."""
    settings = get_settings()
    import httpx

    auth = (settings.twilio_account_sid, settings.twilio_auth_token)
    async with httpx.AsyncClient() as client:
        resp = await client.get(media_url, auth=auth, follow_redirects=True)
        resp.raise_for_status()
        return resp.content
