"""ARQ task definitions for durable background message processing.

Each function here is an ARQ task. The FastAPI webhook enqueues these jobs
into Redis immediately (< 1 ms), returns HTTP 200 to Twilio, and the ARQ
worker process picks them up and executes them asynchronously.

This satisfies the NFR: graceful handling of concurrent webhook spikes
without dropping messages during peak wholesale ordering hours.
"""
from __future__ import annotations

import logging

import httpx

from app.agents.orchestrator import handle_incoming_message
from app.config import get_settings
from app.models.schemas import MessageType
from app.services.s3_service import generate_presigned_url, upload_media
from app.services.transcription_service import transcribe_audio_from_url
from app.services.twilio_service import send_whatsapp_message

logger = logging.getLogger(__name__)


async def process_whatsapp_message(
    ctx,
    from_number: str,
    msg_type: str,
    text_content: str,
    media_url: str | None,
    merchant_id: str,
) -> None:
    """Process a WhatsApp text or image message and send reply via Twilio.

    Enqueued by the webhook for every real-Twilio text/image message so
    the heavy AI pipeline runs outside the 15-second Twilio timeout window.
    """
    try:
        reply = await handle_incoming_message(
            from_number=from_number,
            message_type=MessageType(msg_type),
            text_content=text_content,
            media_url=media_url,
            merchant_id=merchant_id,
        )
        await send_whatsapp_message(from_number, reply)
    except Exception as exc:
        logger.error(
            "ARQ task process_whatsapp_message failed for %s: %s",
            from_number,
            exc,
            exc_info=True,
        )
        raise  # ARQ will retry up to max_tries


async def process_audio_and_reply(
    ctx,
    from_number: str,
    media_url: str,
    content_type: str,
    merchant_id: str,
) -> None:
    """Download, transcribe audio, run orchestrator, and send reply via Twilio.

    Enqueued by the webhook for real-Twilio audio/ogg messages.
    """
    transcript = await _transcribe_twilio_audio(media_url, content_type, from_number)
    if transcript is None:
        await send_whatsapp_message(
            from_number, "Sorry, I couldn't process your voice note."
        )
        return

    try:
        reply = await handle_incoming_message(
            from_number=from_number,
            message_type=MessageType.TEXT,
            text_content=transcript,
            media_url=None,
            merchant_id=merchant_id,
        )
        await send_whatsapp_message(from_number, reply)
    except Exception as exc:
        logger.error(
            "ARQ task process_audio_and_reply failed for %s: %s",
            from_number,
            exc,
            exc_info=True,
        )
        raise


async def _transcribe_twilio_audio(
    media_url: str, content_type: str, from_number: str
) -> str | None:
    """Download from Twilio media URL, upload to S3, transcribe via Groq Whisper.

    Shared by the ARQ task (real Twilio path) and the mock-chat endpoint.
    Returns the transcript string, or None on any failure.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(media_url)
            response.raise_for_status()
            audio_content = response.content

        s3_file_url = await upload_media(
            audio_content, content_type, from_number=from_number
        )
        if not s3_file_url:
            logger.error("Failed to upload audio to S3 for %s", from_number)
            return None

        s3_key = (
            s3_file_url.split(".local/")[-1]
            if ".local/" in s3_file_url
            else s3_file_url.split(".com/")[-1]
        )
        presigned_url = await generate_presigned_url(s3_key, expiration=600)
        if not presigned_url:
            logger.error("Failed to generate pre-signed URL for %s", s3_key)
            return None

        result = await transcribe_audio_from_url(presigned_url, content_type)
        transcript = result["transcript"]
        logger.info("Transcription for %s: %s", from_number, transcript)
        return transcript

    except httpx.RequestError as exc:
        logger.error("HTTP error downloading media from %s: %s", media_url, exc)
        return None
    except Exception as exc:
        logger.error(
            "Error processing audio for %s: %s", from_number, exc, exc_info=True
        )
        return None
