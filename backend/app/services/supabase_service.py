"""Supabase data access layer — all DB reads/writes go through here."""
from __future__ import annotations

import logging
from typing import Optional

import httpx
from supabase import create_client, Client

from app.config import get_settings
from app.models.schemas import CustomerRow, OrderRow, OrderStatus, ProductRow

logger = logging.getLogger(__name__)

def get_supabase() -> Client:
    s = get_settings()
    client = create_client(s.supabase_url, s.supabase_service_key)
    # Supabase PostgREST sends HTTP/2 GOAWAY after ~2 streams, crashing mid-pipeline.
    # Replace the PostgREST httpx session with an HTTP/1.1 client to avoid this.
    old = client.postgrest.session
    client.postgrest.session = httpx.Client(
        base_url=str(old.base_url),
        headers=dict(old.headers),
        http2=False,
    )
    old.close()
    return client


# ─────────────────────────────────────────
# Customer
# ─────────────────────────────────────────

async def get_or_create_customer(whatsapp_number: str, merchant_id: str) -> CustomerRow:
    db = get_supabase()
    result = (
        db.table("customer")
        .select("*")
        .eq("whatsapp_number", whatsapp_number)
        .eq("merchant_id", merchant_id)
        .limit(1)
        .execute()
    )
    if result.data:
        return CustomerRow(**result.data[0])

    new = (
        db.table("customer")
        .insert({"whatsapp_number": whatsapp_number, "merchant_id": merchant_id})
        .execute()
    )
    return CustomerRow(**new.data[0])


async def update_customer_name(customer_id: str, name: str) -> None:
    get_supabase().table("customer").update({"customer_name": name}).eq("customer_id", customer_id).execute()


# ─────────────────────────────────────────
# Orders
# ─────────────────────────────────────────

async def get_pending_order(customer_id: str) -> Optional[OrderRow]:
    """Return the most recent Awaiting Confirmation order for this customer, if any."""
    result = (
        get_supabase()
        .table("order")
        .select("*")
        .eq("customer_id", customer_id)
        .eq("order_status", OrderStatus.AWAITING_CONFIRMATION.value)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return OrderRow(**result.data[0])
    return None


async def get_substitution_pending_order(customer_id: str) -> Optional[OrderRow]:
    """Return the most recent Awaiting Substitution order for this customer, if any."""
    result = (
        get_supabase()
        .table("order")
        .select("*")
        .eq("customer_id", customer_id)
        .eq("order_status", OrderStatus.AWAITING_SUBSTITUTION.value)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return OrderRow(**result.data[0])
    return None


async def get_address_pending_order(customer_id: str) -> Optional[OrderRow]:
    """Return the most recent Pending order waiting for a delivery address reply."""
    result = (
        get_supabase()
        .table("order")
        .select("*")
        .eq("customer_id", customer_id)
        .eq("order_status", OrderStatus.PENDING.value)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        row = result.data[0]
        notes = row.get("order_notes") or ""
        if "awaiting_address" in notes:
            return OrderRow(**row)
    return None


async def get_restock_pending_order(customer_id: str) -> Optional[OrderRow]:
    """Return the most recent Pending order waiting for a restock notification reply."""
    result = (
        get_supabase()
        .table("order")
        .select("*")
        .eq("customer_id", customer_id)
        .eq("order_status", OrderStatus.PENDING.value)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        row = result.data[0]
        notes = row.get("order_notes") or ""
        if "restock_notification" in notes:
            return OrderRow(**row)
    return None


async def get_repeat_pending_order(customer_id: str) -> Optional[OrderRow]:
    """Return the most recent Pending order that has repeat_order metadata (awaiting buyer clarification)."""
    result = (
        get_supabase()
        .table("order")
        .select("*")
        .eq("customer_id", customer_id)
        .eq("order_status", OrderStatus.PENDING.value)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        row = result.data[0]
        notes = row.get("order_notes") or ""
        if "repeat_order" in notes:
            return OrderRow(**row)
    return None

async def get_requires_review_order(customer_id: str) -> Optional[OrderRow]:
    """Return the most recent order that requires human review."""
    result = (
        get_supabase()
        .table("order")
        .select("*")
        .eq("customer_id", customer_id)
        .eq("requires_human_review", True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        row = result.data[0]
        notes = row.get("order_notes") or ""
        if "repeat_order" in notes:
            return OrderRow(**row)
    return None


async def create_order(
    customer_id: str,
    merchant_id: str,
    order_amount: Optional[float],
    order_notes: Optional[str],
    confidence_score: Optional[float],
    requires_human_review: bool,
    status: OrderStatus = OrderStatus.PENDING,
) -> OrderRow:
    row = (
        get_supabase()
        .table("order")
        .insert({
            "customer_id": customer_id,
            "merchant_id": merchant_id,
            "order_amount": order_amount,
            "order_notes": order_notes,
            "confidence_score": confidence_score,
            "requires_human_review": requires_human_review,
            "order_status": status.value,
        })
        .execute()
    )
    return OrderRow(**row.data[0])

async def get_order_by_id(order_id: str) -> Optional[dict]:
    """Fetch a single order with joined customer data."""
    result = (
        get_supabase()
        .table("order")
        .select("*, customer(*)")
        .eq("order_id", order_id)
        .single()
        .execute()
    )
    return result.data if result.data else None

async def update_order(order_id: str, payload: dict) -> None:
    """Generic update for any order columns."""
    get_supabase().table("order").update(payload).eq("order_id", order_id).execute()

async def update_order_status(order_id: str, status: OrderStatus, **extra) -> None:
    payload = {"order_status": status.value, **extra}
    if status == OrderStatus.CONFIRMED:
        from datetime import datetime, timezone
        payload["confirmed_at"] = datetime.now(timezone.utc).isoformat()
    get_supabase().table("order").update(payload).eq("order_id", order_id).execute()


async def create_order_items(order_id: str, items: list[dict]) -> None:
    rows = [{"order_id": order_id, **item} for item in items]
    get_supabase().table("order_item").insert(rows).execute()


async def get_order_items(order_id: str) -> list[dict]:
    result = (
        get_supabase()
        .table("order_item")
        .select("*")
        .eq("order_id", order_id)
        .execute()
    )
    return result.data or []


async def get_last_confirmed_order(customer_id: str) -> Optional[dict]:
    """Return the most recent Confirmed/Dispatched order with its items for repeat-order logic."""
    result = (
        get_supabase()
        .table("order")
        .select("*, order_item(*)")
        .eq("customer_id", customer_id)
        .in_("order_status", [OrderStatus.CONFIRMED.value, OrderStatus.DISPATCHED.value])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


# ─────────────────────────────────────────
# Products
# ─────────────────────────────────────────

async def get_products(merchant_id: str) -> list[ProductRow]:
    result = (
        get_supabase()
        .table("product")
        .select("*")
        .eq("merchant_id", merchant_id)
        .execute()
    )
    return [ProductRow(**r) for r in (result.data or [])]


async def get_product_by_id(product_id: str) -> Optional[ProductRow]:
    result = (
        get_supabase()
        .table("product")
        .select("*")
        .eq("product_id", product_id)
        .limit(1)
        .execute()
    )
    if result.data:
        return ProductRow(**result.data[0])
    return None


async def deduct_stock(product_id: str, qty: int) -> bool:
    """Atomically deduct stock. Returns False if insufficient stock."""
    product = await get_product_by_id(product_id)
    if not product or product.stock_quantity < qty:
        return False
    new_qty = product.stock_quantity - qty
    get_supabase().table("product").update({"stock_quantity": new_qty}).eq("product_id", product_id).execute()
    return True


# ─────────────────────────────────────────
# Logistics
# ─────────────────────────────────────────

async def create_logistic(
    order_id: str,
    provider: str,
    tracking_url: str,
    estimated_price: float,
    eta_minutes: int,
) -> str:
    row = (
        get_supabase()
        .table("logistic")
        .insert({
            "order_id": order_id,
            "provider_name": provider,
            "tracking_url": tracking_url,
            "logistic_status": "Booked",
            "estimated_price": estimated_price,
            "eta_minutes": eta_minutes,
        })
        .execute()
    )
    return row.data[0]["delivery_id"]


# ─────────────────────────────────────────
# Conversation log
# ─────────────────────────────────────────

async def log_message(
    customer_id: str,
    sender_type: str,
    message_type: str,
    content: str,
    order_id: Optional[str] = None,
    media_url: Optional[str] = None,
) -> None:
    get_supabase().table("conversation_log").insert({
        "customer_id": customer_id,
        "order_id": order_id,
        "sender_type": sender_type,
        "message_type": message_type,
        "content": content,
        "media_url": media_url,
    }).execute()


# ─────────────────────────────────────────
# Dashboard queries
# ─────────────────────────────────────────

async def get_orders_with_details(merchant_id: str, limit: int = 100) -> list[dict]:
    """Return orders joined with customer info and items for dashboard."""
    result = (
        get_supabase()
        .table("order")
        .select("*, customer(customer_name, whatsapp_number), order_item(*)")
        .eq("merchant_id", merchant_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


async def get_inventory(merchant_id: str) -> list[dict]:
    result = (
        get_supabase()
        .table("product")
        .select("product_id, product_name, product_sku, stock_quantity, unit_price, unit, reorder_threshold")
        .eq("merchant_id", merchant_id)
        .order("product_name")
        .execute()
    )
    return result.data or []


async def get_knowledge_base_rules(merchant_id: str) -> str:
    """Return concatenated business rules text for RAG injection."""
    result = (
        get_supabase()
        .table("knowledge_base")
        .select("content")
        .eq("merchant_id", merchant_id)
        .eq("document_type", "business_rules")
        .execute()
    )
    return "\n\n".join(r["content"] for r in (result.data or []))
