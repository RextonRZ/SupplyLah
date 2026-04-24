"""AWS S3 media storage for voice notes and order images."""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


async def upload_media(data: bytes, content_type: str, from_number: Optional[str] = None, filename: Optional[str] = None) -> str:
    """Upload bytes to S3 and return the public URL (or a mock URL)."""
    settings = get_settings()
    
    # 1. Determine the extension
    ext = content_type.split('/')[-1] if '/' in content_type else "bin"
    # Normalize common audio extensions for Whisper/S3
    if "mpeg" in ext or "mpga" in ext: ext = "mp3"
    if "octet-stream" in ext: ext = "m4a" # Common for WhatsApp web blobs

    # 2. Construct the Key (Path)
    # Target: voice_notes/{phone_number}/{unique_id}.{ext}
    unique_id = uuid.uuid4().hex
    dir_name = "voice_notes" if "audio" in content_type else "images"
    
    if filename:
        key = filename # Respect caller's override
    elif from_number:
        key = f"{dir_name}/{from_number.strip('+')}/{unique_id}.{ext}"
    else:
        key = f"{dir_name}/unknown/{unique_id}.{ext}"

    if not settings.aws_access_key_id:
        mock_url = f"https://mock-s3.supplylah.local/{key}"
        logger.info("[MOCK S3] Uploading %d bytes to %s", len(data), key)
        return mock_url

    import boto3  # type: ignore

    s3 = boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )
    s3.put_object(
        Bucket=settings.aws_bucket_name,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    url = f"https://{settings.aws_bucket_name}.s3.{settings.aws_region}.amazonaws.com/{key}"
    logger.info("Uploaded media to S3: %s", url)
    return url

async def generate_presigned_url(object_key: str, expiration: int = 3600) -> str:
    """Generate a pre-signed URL for an S3 object (or a mock one)."""
    settings = get_settings()
    
    if not settings.aws_access_key_id:
        return f"https://mock-s3.supplylah.local/{object_key}?token=mock-presigned"

    import boto3 # type: ignore
    s3 = boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )
    
    try:
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.aws_bucket_name, "Key": object_key},
            ExpiresIn=expiration,
        )
        return url
    except Exception as e:
        logger.error("Error generating presigned URL for %s: %s", object_key, e)
        return f"https://{settings.aws_bucket_name}.s3.{settings.aws_region}.amazonaws.com/{object_key}"