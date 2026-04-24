import os
import httpx
import logging
from groq import Groq
from tempfile import NamedTemporaryFile
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)

def get_groq_client():
    settings = get_settings()
    return Groq(api_key=settings.groq_api_key)

SUPPORTED_FORMATS = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg"}

# Path to the new prompt file
_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "transcription_prompt.md"

def _load_transcription_prompt() -> str:
    """Load the guiding prompt from markdown. Whisper prompts are max 896 characters."""
    try:
        content = _PROMPT_PATH.read_text(encoding="utf-8")
        
        # Groq limit is 896 characters. Truncate to be safe.
        if len(content) > 896: 
            logger.warning(f"Transcription prompt too long ({len(content)} chars). Truncating to 896.")
            return content[:896].strip()
            
        return content.strip()
    except Exception as e:
        logger.error(f"Failed to load transcription prompt: {e}")
        return "Malaysian wholesale grocery order. Mixed Malay and English."

async def transcribe_audio_from_url(audio_url: str, content_type: str) -> dict:
    file_ext = "." + content_type.split('/')[-1] if '/' in content_type else os.path.splitext(audio_url)[1].lower()
    if file_ext not in SUPPORTED_FORMATS:
         # Fallback for common mismatches if needed, but primarily rely on input
        if "ogg" in content_type: file_ext = ".ogg" 
        elif "m4a" in content_type: file_ext = ".m4a"
        else: raise ValueError(f"Unsupported or ambiguous audio format: {file_ext} (from {content_type})")
    
    prompt_text = _load_transcription_prompt()

    async with httpx.AsyncClient() as http_client:
        # Download from S3 Pre-signed URL
        response = await http_client.get(audio_url)
        response.raise_for_status()

        with NamedTemporaryFile(delete=True, suffix=file_ext) as temp_audio:
            temp_audio.write(response.content)
            temp_audio.flush()
            temp_audio.seek(0)

            client = get_groq_client()
            clean_filename = f"audio_file{file_ext}"
            
            transcription = client.audio.transcriptions.create(
                file=(clean_filename, temp_audio.read()), 
                model="whisper-large-v3",
                prompt=prompt_text,
                response_format="verbose_json",
                temperature=0.0
            )

    data = transcription.model_dump() if hasattr(transcription, "model_dump") else dict(transcription)
    
    segments = data.get("segments") or []
    avg_log_prob = sum(s.get("avg_logprob", 0) for s in segments) / len(segments) if segments else -1.0
    
    return {
        "transcript": data.get("text", "").strip(),
        "detected_language": data.get("language"),
        "avg_log_prob": avg_log_prob,
        "is_low_confidence": avg_log_prob < -0.7,
        "segments": [
            {
                "text": s.get("text"),
                "start": s.get("start"),
                "end": s.get("end"),
                "confidence": s.get("avg_logprob")
            }
            for s in segments
        ]
    }