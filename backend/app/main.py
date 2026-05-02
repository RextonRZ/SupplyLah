"""FastAPI application entry point."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

import structlog
from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.orchestrator import ensure_inventory_worker
from app.config import get_settings
from app.webhook import router as webhook_router
from app.routes import dashboard_router

# ─────────────────────────────────────────
# Logging
# ─────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────
# Lifespan
# ─────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("SupplyLah backend starting up…")
    ensure_inventory_worker()
    app.state.arq_pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    logger.info("ARQ Redis pool connected at %s", settings.redis_url)
    yield
    await app.state.arq_pool.close()
    logger.info("SupplyLah backend shutting down.")


# ─────────────────────────────────────────
# App
# ─────────────────────────────────────────

app = FastAPI(
    title="SupplyLah API",
    description="AI-powered supply chain automation for Malaysian SME wholesalers",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()

_raw_origins = settings.allowed_origins or "http://localhost:3000,http://127.0.0.1:3000"
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook_router, tags=["Webhooks"])
app.include_router(dashboard_router, prefix="/api", tags=["Dashboard"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "SupplyLah"}
