"""Supabase data access layer — all DB reads/writes go through here."""
from __future__ import annotations

import asyncio
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


async def get_product_clarification_order(customer_id: str) -> Optional[OrderRow]:
    """Return the most recent Pending order awaiting product clarification from the buyer."""
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
        if "product_clarification" in notes:
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
    """Atomically deduct stock via a single SQL UPDATE with a WHERE guard.
    Returns False if stock is insufficient or the product does not exist."""
    result = get_supabase().rpc(
        "deduct_stock_atomic",
        {"p_product_id": product_id, "p_qty": qty},
    ).execute()
    new_qty = result.data
    return isinstance(new_qty, int) and new_qty >= 0


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


async def retrieve_few_shot_examples(query_embedding: list[float], match_count: int = 3) -> list[dict]:
    """Return the most semantically similar few-shot examples for dynamic prompt injection."""
    result = get_supabase().rpc(
        "match_few_shot_examples",
        {"query_embedding": query_embedding, "match_count": match_count},
    ).execute()
    return result.data or []


async def resolve_product(
    raw_item_name: str,
    merchant_id: str,
) -> Optional[ProductRow]:
    """Resolve a raw product name to a ProductRow via three-tier hybrid search.

    Tier 1 — ILIKE: case-insensitive substring match on product_name.
    Tier 2 — Alias: raw name found inside the slang_aliases text[] column.
    Tier 3 — Vector: pgvector cosine similarity via match_products RPC
              (threshold 0.60, non-blocking via asyncio.to_thread).

    Returns None when no match is found across all three tiers.
    """
    db = get_supabase()
    name = raw_item_name.strip()

    # ── Tier 1: ILIKE on product_name ──────────────────────────────────────
    result = (
        db.table("product")
        .select("*")
        .eq("merchant_id", merchant_id)
        .ilike("product_name", f"%{name}%")
        .limit(1)
        .execute()
    )
    if result.data:
        logger.debug("resolve_product [ILIKE] '%s' → %s", name, result.data[0]["product_name"])
        return ProductRow(**result.data[0])

    # ── Tier 2: Alias containment (slang_aliases @> ARRAY[name]) ──────────
    # PostgREST cs operator checks that the column contains all listed elements.
    result = (
        db.table("product")
        .select("*")
        .eq("merchant_id", merchant_id)
        .filter("slang_aliases", "cs", f'{{"{name.lower()}"}}')
        .limit(1)
        .execute()
    )
    if result.data:
        logger.debug("resolve_product [Alias] '%s' → %s", name, result.data[0]["product_name"])
        return ProductRow(**result.data[0])

    # ── Tier 3: pgvector semantic search ───────────────────────────────────
    # embed_text() is CPU-bound — run in a thread pool so it doesn't block
    # the asyncio event loop during peak webhook spikes.
    from app.services import embedding_service
    embedding = await asyncio.to_thread(embedding_service.embed_text, name)
    result = db.rpc(
        "match_products",
        {
            "query_embedding": embedding,
            "p_merchant_id": merchant_id,
            "match_threshold": 0.60,
            "match_count": 1,
        },
    ).execute()
    if result.data:
        logger.debug(
            "resolve_product [Vector] '%s' → %s (score ≥ 0.60)",
            name, result.data[0].get("product_name"),
        )
        return ProductRow(**result.data[0])

    logger.warning("resolve_product: no match found for '%s' (merchant %s)", name, merchant_id)
    return None


async def resolve_product_candidates(
    raw_item_name: str,
    merchant_id: str,
    top_n: int = 3,
) -> list[ProductRow]:
    """Return up to top_n candidate ProductRows for an ambiguous item name.

    Uses the pgvector match_products RPC at a lower threshold (0.45) so that
    plausible-but-uncertain matches surface as choices for the buyer.
    Re-fetches full product rows by ID so that all fields (unit, stock_quantity,
    slang_aliases, etc.) are always present regardless of what the RPC returns.
    """
    from app.services import embedding_service
    db = get_supabase()
    name = raw_item_name.strip()
    embedding = await asyncio.to_thread(embedding_service.embed_text, name)
    rpc_result = db.rpc(
        "match_products",
        {
            "query_embedding": embedding,
            "p_merchant_id": merchant_id,
            "match_threshold": 0.45,
            "match_count": top_n,
        },
    ).execute()
    if not rpc_result.data:
        return []
    # Re-fetch full rows by product_id to guarantee all columns (unit, stock_quantity, etc.)
    product_ids = [r["product_id"] for r in rpc_result.data]
    full_result = (
        db.table("product")
        .select("*")
        .in_("product_id", product_ids)
        .execute()
    )
    # Preserve the RPC's relevance ordering
    order_map = {pid: idx for idx, pid in enumerate(product_ids)}
    rows = sorted(full_result.data or [], key=lambda r: order_map.get(r["product_id"], 999))
    return [ProductRow(**r) for r in rows]


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
