"""Twilio WhatsApp webhook receiver and mock chat endpoint."""
from __future__ import annotations

import asyncio
import json
import logging
import asyncio
import httpx

from fastapi import APIRouter, Form, Header, HTTPException, Request
from fastapi.responses import PlainTextResponse, StreamingResponse

from app.agents.orchestrator import handle_incoming_message, _msg_collector
from app.config import get_settings
from app.models.schemas import IncomingMessage, MessageType
from app.services import log_stream
from app.services.twilio_service import send_whatsapp_message
from app.services.s3_service import upload_media, generate_presigned_url
from app.services.transcription_service import transcribe_audio_from_url 

from pathlib import Path

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
    
    transcribed_text = None

    # Determine message type
    if int(NumMedia) > 0 and MediaUrl0:
        ct = MediaContentType0.lower()
        if "audio" in ct or "ogg" in ct:
            msg_type = MessageType.AUDIO
            # Process audio here for real Twilio path
            if not settings.use_mock_whatsapp: # Only process for real Twilio path
                # Kick off audio processing in the background, don't wait for it
                asyncio.create_task(
                    _process_audio_message_and_reply(from_number, MediaUrl0, MediaContentType0, settings)
                )
                # Return empty TwiML immediately
                return PlainTextResponse(
                    content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                    media_type="application/xml",
                )
            
        elif "image" in ct:
            msg_type = MessageType.IMAGE
        else:
            msg_type = MessageType.TEXT
    else:
        msg_type = MessageType.TEXT
        
    # --- Synchronous path for mock_whatsapp (and text/image messages for real Twilio) ---
    if msg_type == MessageType.AUDIO and settings.use_mock_whatsapp:
        # For mock WhatsApp, we want to wait for transcription to simulate synchronous flow
        transcribed_text = await _process_audio_message(MediaUrl0, MediaContentType0, from_number)
        if transcribed_text is None:
            await send_whatsapp_message(from_number, "Sorry, I couldn't process your voice note.")
            return PlainTextResponse(content="OK")
        msg_type = MessageType.TEXT # After transcription, treat as text message
        
    final_text = transcribed_text or Body
    final_media_url = MediaUrl0 if msg_type == MessageType.IMAGE else None

    if settings.use_mock_whatsapp:
        # Mock path: process synchronously (no real Twilio timeout to worry about)
        try:
            reply = await handle_incoming_message(
                from_number=from_number,
                message_type=msg_type,
                text_content=final_text,
                media_url=final_media_url,
                merchant_id=settings.default_merchant_id,
            )
            await send_whatsapp_message(from_number, reply)
        except Exception as exc:
            logger.error("Webhook processing error: %s", exc, exc_info=True)
        return PlainTextResponse(content="OK")

    # Real Twilio path: Twilio has a 15-second webhook timeout but AI processing
    # can take longer. Return empty TwiML immediately, then send reply via outbound API.

    async def _process_and_reply():
        try:
            reply = await handle_incoming_message(
                from_number=from_number,
                message_type=msg_type,
                text_content=final_text,
                media_url=final_media_url,
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

# Helper for real Twilio audio path
async def _process_audio_message_and_reply(from_number: str, media_url: str, content_type: str, settings):
    """Processes audio and sends a reply for the real Twilio path (background task)."""
    transcript = await _process_audio_message(media_url, content_type, from_number)
    if transcript is None:
        await send_whatsapp_message(from_number, "Sorry, I couldn't process your voice note.")
        return

    try:
        reply = await handle_incoming_message(
            from_number=from_number,
            message_type=MessageType.TEXT, # Always TEXT after transcription
            text_content=transcript,
            media_url=None, # No media_url needed after transcription
            merchant_id=settings.default_merchant_id,
        )
        await send_whatsapp_message(from_number, reply)
    except Exception as exc:
        logger.error("Webhook background audio reply error: %s", exc, exc_info=True)


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

    # Register SSE session BEFORE any emits so logs reach the frontend
    if x_session_id:
        log_stream.set_session(x_session_id)

    text_content = payload.text_content
    message_type = payload.message_type
    media_url = payload.media_url

    if message_type == MessageType.AUDIO and payload.media_url:
        if "ok.m4a" in payload.media_url:
            target_filename = "ok.m4a"
        else:
            target_filename = "order.m4a"

        demo_audio_path = Path(__file__).parent.parent / "app" / "assets" / "demo" / "voice_notes" / target_filename
        if not demo_audio_path.exists():
            logger.error(f"Demo audio file not found at {demo_audio_path}")
            raise HTTPException(status_code=500, detail=f"Demo audio file {target_filename} not found.")

        try:
            from app.services.log_stream import emit
            emit("🎙️ [Transcription] Uploading voice note to S3...")

            with open(demo_audio_path, "rb") as f:
                audio_content = f.read()

            s3_file_url = await upload_media(audio_content, "audio/m4a", from_number=payload.from_number)

            if not s3_file_url:
                raise Exception("Failed to upload demo audio to S3.")

            s3_key = s3_file_url.split(".local/")[-1] if ".local/" in s3_file_url else s3_file_url.split(".com/")[-1]
            presigned_url = await generate_presigned_url(s3_key)

            if not presigned_url:
                raise Exception("Failed to generate pre-signed URL for demo audio.")

            emit("🎙️ [Transcription] Calling Groq Whisper-v3 for transcription...")
            transcription_result = await transcribe_audio_from_url(presigned_url, "audio/m4a")
            text_content = transcription_result["transcript"]
            message_type = MessageType.TEXT
            media_url = None
            logger.info(f"Mock chat transcription ({target_filename}): {text_content}")

            emit(f"🎙️ [Transcription] Result: \"{text_content[:100]}{'...' if len(text_content) > 100 else ''}\"")

        except Exception as exc:
            logger.error("Mock chat audio processing error: %s", exc, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Mock chat audio error: {str(exc)}")
    try:
        await handle_incoming_message(
            from_number=payload.from_number,
            message_type=message_type,      # Changed from payload.message_type
            text_content=text_content,      # Changed from payload.text_content
            media_url=media_url,            # Changed from payload.media_url
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

# ─────────────────────────────────────────
# Helper function for audio processing
# ─────────────────────────────────────────
async def _process_audio_message(
    media_url: str, content_type: str, from_number: str
) -> str | None:
    """Downloads audio, uploads to S3, transcribes, and returns the transcript."""
    settings = get_settings()

    try:
        # 1. Download audio from Twilio Media URL
        async with httpx.AsyncClient() as client_http:
            audio_response = await client_http.get(media_url)
            audio_response.raise_for_status()
            audio_content = audio_response.content

        # 2. Upload to S3
        s3_file_url = await upload_media(audio_content, content_type, from_number=from_number)

        if not s3_file_url:
            logger.error(f"Failed to upload audio to S3 for {from_number}")
            return None

        # 3. Generate pre-signed URL for Groq (if direct S3 URL isn't sufficient or secure)
        # Note: Groq's Whisper API requires the actual file content, so we download again in transcription_service.
        # However, for consistency and future-proofing (if Groq adds direct URL support), we keep this pattern.
        # For now, transcription_service will download from this pre-signed URL.
        s3_key = s3_file_url.split(".local/")[-1] if ".local/" in s3_file_url else s3_file_url.split(".com/")[-1]
        presigned_url = await generate_presigned_url(s3_key, expiration=600) # Valid for 10 minutes

        if not presigned_url:
            logger.error(f"Failed to generate pre-signed URL for {s3_key}")
            return None

        # 4. Transcribe using Groq
        transcription_result = await transcribe_audio_from_url(presigned_url, content_type)
        transcript = transcription_result["transcript"]
        logger.info(f"Transcription for {from_number}: {transcript}")
        return transcript

    except httpx.RequestError as e:
        logger.error(f"HTTP error downloading media from {media_url}: {e}")
        return None
    except Exception as e:
        logger.error(f"Error processing audio for {from_number}: {e}", exc_info=True)
        return None
    
    