"""ARQ worker entry point.

Start the worker process with:
    arq app.workers.worker.WorkerSettings

Or via docker-compose (see docker-compose.yml worker service).
"""
from __future__ import annotations

import logging

from arq.connections import RedisSettings

from app.agents.orchestrator import ensure_inventory_worker
from app.config import get_settings
from app.workers.tasks import process_audio_and_reply, process_whatsapp_message

logger = logging.getLogger(__name__)


async def on_startup(ctx) -> None:
    """Called once when the ARQ worker process starts."""
    logger.info("ARQ worker starting up — initialising inventory serialisation queue…")
    ensure_inventory_worker()


async def on_shutdown(ctx) -> None:
    logger.info("ARQ worker shutting down.")


_settings = get_settings()


class WorkerSettings:
    """ARQ worker configuration."""

    functions = [process_whatsapp_message, process_audio_and_reply]
    on_startup = on_startup
    on_shutdown = on_shutdown
    redis_settings = RedisSettings.from_dsn(_settings.redis_url)

    # Concurrency: up to 20 jobs running simultaneously in a single worker process.
    # Scale horizontally by adding more worker replicas in docker-compose.
    max_jobs = 20

    # Kill a job if it hasn't finished within 5 minutes (covers worst-case LLM latency).
    job_timeout = 300

    # Retry failed jobs up to 3 times with exponential back-off.
    max_tries = 3

    # Keep job results in Redis for 1 hour for debugging/observability.
    keep_result = 3600
