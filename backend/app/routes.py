"""Dashboard API routes — order management, inventory, stats."""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.models.schemas import DashboardStats, OrderStatus
from app.services import supabase_service

logger = logging.getLogger(__name__)
dashboard_router = APIRouter()

_stats_cache: dict[str, dict] = {}
_STATS_TTL = 60.0


# ─────────────────────────────────────────
# Orders
# ─────────────────────────────────────────

@dashboard_router.get("/orders")
async def list_orders(merchant_id: str = None, limit: int = 100):
    mid = merchant_id or get_settings().default_merchant_id
    orders = await supabase_service.get_orders_with_details(mid, limit)
    return {"orders": orders}


@dashboard_router.get("/orders/{order_id}/items")
async def get_order_items(order_id: str):
    items = await supabase_service.get_order_items(order_id)
    return {"items": items}


class OverrideRequest(BaseModel):
    status: OrderStatus
    notes: str = ""


@dashboard_router.patch("/orders/{order_id}/override")
async def override_order(order_id: str, body: OverrideRequest):
    """Manual override by wholesaler staff for escalated orders."""
    await supabase_service.update_order_status(
        order_id, body.status, order_notes=body.notes, requires_human_review=False
    )
    return {"success": True, "order_id": order_id, "new_status": body.status}


# ─────────────────────────────────────────
# Inventory
# ─────────────────────────────────────────

@dashboard_router.get("/inventory")
async def get_inventory(merchant_id: str = None):
    mid = merchant_id or get_settings().default_merchant_id
    try:
        inventory = await supabase_service.get_inventory(mid)
    except Exception as e:
        import logging
        logging.error("Transient error fetching inventory: %s", e)
        inventory = []
    return {"inventory": inventory}


# ─────────────────────────────────────────
# Stats
# ─────────────────────────────────────────

@dashboard_router.get("/stats", response_model=DashboardStats)
async def get_stats(merchant_id: str = None):
    mid = merchant_id or get_settings().default_merchant_id

    cached = _stats_cache.get(mid)
    if cached and time.monotonic() - cached["ts"] < _STATS_TTL:
        return cached["data"]

    try:
        orders = await supabase_service.get_orders_with_details(mid, limit=500)
    except Exception as e:
        logger.error("Transient error fetching stats: %s", e)
        orders = []

    from datetime import date
    today = date.today().isoformat()

    total_today = sum(1 for o in orders if (o.get("created_at") or "").startswith(today))
    counts = {s.value: 0 for s in OrderStatus}
    review_count = 0

    for o in orders:
        st = o.get("order_status", "")
        if st in counts:
            counts[st] += 1
        if o.get("requires_human_review"):
            review_count += 1

    result = DashboardStats(
        total_today=total_today,
        pending=counts[OrderStatus.PENDING.value],
        awaiting_substitution=counts[OrderStatus.AWAITING_SUBSTITUTION.value],
        awaiting_confirmation=counts[OrderStatus.AWAITING_CONFIRMATION.value],
        confirmed=counts[OrderStatus.CONFIRMED.value],
        dispatched=counts[OrderStatus.DISPATCHED.value],
        failed=counts[OrderStatus.FAILED.value],
        requires_review=review_count,
    )
    _stats_cache[mid] = {"ts": time.monotonic(), "data": result}
    return result
