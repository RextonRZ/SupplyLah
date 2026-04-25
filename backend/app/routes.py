"""Dashboard API routes — order management, inventory, stats."""
from __future__ import annotations
from app.services.log_stream import emit, emit_message 

import json
import logging
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.models.schemas import DashboardStats, OrderStatus
from app.services import supabase_service, twilio_service
from pydantic import BaseModel
class ResolveOrderRequest(BaseModel):
    order_id: str
    amount: float
    status: str
    notes: str
    merchant_id: str


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

@dashboard_router.post("/orders/resolve")
async def resolve_order(payload: ResolveOrderRequest):
    """
    Called by the Admin Dashboard Modal to manually correct an order.
    Clears the human_review flag and notifies the buyer.
    """
    # 1. Validation
    if payload.amount < 0:
        raise HTTPException(status_code=400, detail="Order amount cannot be negative")

    # 2. Extract Language from metadata
    try:
        metadata = json.loads(payload.notes)
        lang = metadata.get("language") or metadata.get("intake_result", {}).get("language_detected", "ms")
    except Exception:
        lang = "ms"

    # 3. Update the Order in DB
    update_payload = {
        "order_amount": payload.amount,
        "order_status": payload.status,
        "order_notes": payload.notes,
        "requires_human_review": False,
        "updated_at": "now()"
    }
    await supabase_service.update_order(payload.order_id, update_payload)
    
    order = await supabase_service.get_order_by_id(payload.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    customer_phone = order['customer']['whatsapp_number']
    
    # 4. Notify the Buyer (Resume Pipeline message)
    if payload.status == "Awaiting Confirmation":
        msg = (
            "✅ Ejen kami telah menyemak maklumat anda." if lang == "ms"
            else "✅ Our agent has reviewed your info."
        )
        
        await supabase_service.log_message(
            customer_id=order['customer_id'],
            order_id=payload.order_id,
            sender_type="agent",
            message_type="text",
            content=msg
        )
        
        # Block and run inventory and quote (so frontend says 'loading...')
        try:
            from app.agents.orchestrator import resume_pipeline_after_manual_review
            from app.models.schemas import CustomerRow
            
            customer_data = order.get('customer', {})
            customer_row = CustomerRow(
                customer_id=customer_data.get('customer_id', ''),
                customer_name=customer_data.get('customer_name') or '',
                whatsapp_number=customer_data.get('whatsapp_number', ''),
                delivery_address=customer_data.get('delivery_address'),
                merchant_id=order.get('merchant_id', ''),
            )
            await resume_pipeline_after_manual_review(
                payload.order_id, 
                payload.notes, 
                lang, 
                order['merchant_id'], 
                customer_row
            )
        except Exception as e:
            logger.error(f"Failed to start pipeline resume: {e}", exc_info=True)
            
    elif payload.status == "Confirmed":
        msg = (
            "✅ Pesanan anda telah disahkan secara manual. Kami akan atur penghantaran segera! 🚚" if lang == "ms"
            else "✅ Your order has been manually confirmed. We are arranging delivery now! 🚚"
        )
        await supabase_service.log_message(customer_id=order['customer_id'], order_id=payload.order_id, sender_type="agent", message_type="text", content=msg)
    else:
        msg = (
            "Ejen kami telah mengemaskini maklumat pesanan anda. 🙏" if lang == "ms"
            else "Our agent has updated your order details. 🙏"
        )
        await supabase_service.log_message(customer_id=order['customer_id'], order_id=payload.order_id, sender_type="agent", message_type="text", content=msg)

    await twilio_service.send_whatsapp_message(customer_phone, msg)
    
    emit_message(msg) 
    emit(f"👤 [Human Intervention] Order #{payload.order_id[:8]} resolved manually.")
    
    # Fetch refreshed logs AFTER pipeline completes
    import asyncio as _asyncio
    await _asyncio.sleep(0.5)  # brief wait for DB writes to settle
    from app.services.supabase_service import get_supabase
    logs_res = get_supabase().table("conversation_log").select("*").eq("customer_id", order['customer_id']).order("created_at", desc=False).limit(100).execute()
    updated_logs = logs_res.data or []

    return {
        "success": True,
        "order_id": payload.order_id,
        "message": None,
        "log": None,
        "updated_logs": updated_logs
    }

@dashboard_router.patch("/orders/{order_id}/override")
async def override_order(order_id: str, body: OverrideRequest):
    """
    Manual override by staff (e.g. Rejecting an order from the Kanban card).
    """
    # 1. Update DB
    await supabase_service.update_order(
        order_id, 
        {
            "order_status": body.status,
            "order_notes": body.notes,
            "requires_human_review": False,
            "updated_at": "now()"
        }
    )
    
    msg = ""
    log_entry = ""
    
    
    # 2. Handle Notification for Rejections
    if body.status in ["Failed", "Expired"]:
        order = await supabase_service.get_order_by_id(order_id)
        if order:
            customer_phone = order['customer']['whatsapp_number']
            # Simple language detection from notes
            lang = "ms" if "ms" in (order.get("order_notes") or "") else "en"
            
            msg = (
                "Maaf, pesanan anda tidak dapat diproses buat masa ini. Terima kasih! 😊" if lang == "ms"
                else "Sorry, your order cannot be processed at this time. Thank you! 😊"
            )
            await twilio_service.send_whatsapp_message(customer_phone, msg)
            log_entry = f"🚫 [Human Intervention] Order {body.status} by operator."
            
            emit_message(msg)
            emit(f"🚫 [Human Intervention] Order #{order_id[:8]} rejected by staff.")
            
            await supabase_service.log_message(
                customer_id=order['customer_id'],
                order_id=order_id,
                sender_type="agent",
                message_type="text",
                content=msg
            )

    # 🔴 ADD THIS RETURN
    return {
        "success": True, 
        "order_id": order_id, 
        "new_status": body.status, 
        "message": msg, 
        "log": log_entry
    }