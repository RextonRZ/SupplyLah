"""AWS S3 media storage for voice notes and order images."""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


async def upload_media(data: bytes, content_type: str, filename: Optional[str] = None) -> str:
    """Upload bytes to S3 and return the public URL (or a mock URL)."""
    settings = get_settings()
    key = filename or f"media/{uuid.uuid4()}"

    if not settings.aws_access_key_id:
        mock_url = f"https://mock-s3.supplylah.local/{key}"
        logger.info("[MOCK S3] Would upload %d bytes as %s → %s", len(data), content_type, mock_url)
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
