"""FastAPI application entry point."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

import structlog
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
    logger.info("SupplyLah backend starting up…")
    ensure_inventory_worker()
    yield
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook_router, tags=["Webhooks"])
app.include_router(dashboard_router, prefix="/api", tags=["Dashboard"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "SupplyLah"}
