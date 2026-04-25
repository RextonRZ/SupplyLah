"""Dashboard API routes — order management, inventory, stats."""
from __future__ import annotations

import logging
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.models.schemas import DashboardStats, OrderStatus
from app.services import supabase_service, twilio_service

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


# ─────────────────────────────────────────
# Team Invite
# ─────────────────────────────────────────

class InviteRequest(BaseModel):
    merchant_id: str
    email: str
    phone: str
    role: str
    business_name: str = "SupplyLah"

ROLE_ACCESS = {
    "Warehouse Manager": "View and manage orders and inventory. Cannot access settings or team.",
    "Wholesale Supplier": "Read-only view of orders and stock levels.",
}

@dashboard_router.post("/team/invite")
async def invite_team_member(body: InviteRequest):
    import httpx as _httpx
    settings = get_settings()

    if body.role not in ROLE_ACCESS:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")

    # Use httpx directly with service key — bypasses Python SDK HTTP/1.1 override issue
    _headers = {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    # 1. Upsert via SECURITY DEFINER RPC — bypasses RLS entirely
    async with _httpx.AsyncClient() as http:
        resp = await http.post(
            f"{settings.supabase_url}/rest/v1/rpc/upsert_team_member",
            headers=_headers,
            json={
                "p_merchant_id": body.merchant_id,
                "p_email": body.email,
                "p_phone": body.phone,
                "p_role": body.role,
            },
        )
        if resp.status_code >= 400:
            logger.error("upsert_team_member RPC failed: %s %s", resp.status_code, resp.text)
            raise HTTPException(status_code=500, detail="Failed to save team member")

    # 2. Send Supabase auth invite email via Admin REST API
    try:
        async with _httpx.AsyncClient() as http:
            resp = await http.post(
                f"{settings.supabase_url}/auth/v1/invite",
                headers={
                    "apikey": settings.supabase_service_key,
                    "Authorization": f"Bearer {settings.supabase_service_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "email": body.email,
                    "redirect_to": f"{settings.frontend_url}/auth/callback",
                    "data": {
                        "merchant_id": body.merchant_id,
                        "role": body.role,
                        "business_name": body.business_name,
                    },
                },
            )
            if resp.status_code >= 400:
                logger.warning("Supabase invite email failed: %s %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("Supabase invite email failed: %s", exc)

    # 3. Send WhatsApp notification
    access_desc = ROLE_ACCESS.get(body.role, "")
    wa_msg = (
        f"Hi! You've been invited to join *{body.business_name}* on SupplyLah 🎉\n\n"
        f"Role: *{body.role}*\n"
        f"Access: {access_desc}\n\n"
        f"Check your email ({body.email}) to set up your password and log in.\n"
        f"📲 Login at: https://supplylah.vercel.app/login"
    )
    try:
        await twilio_service.send_whatsapp_message(body.phone, wa_msg)
    except Exception as exc:
        logger.warning("WhatsApp invite notification failed: %s", exc)

    return {"success": True}
