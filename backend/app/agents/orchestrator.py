"""Main orchestrator — stateful message router and workflow state machine.

Flow:
  Incoming message → lookup customer → check pending order state →
    NEW: immediate ack → Intake → "checking stock" → Inventory → save quote → Awaiting Confirmation
    AWAITING CONFIRMATION: detect YES/NO → Logistics | Expire
"""
from __future__ import annotations

import asyncio
import logging
from contextvars import ContextVar
from typing import Optional

from app.agents.intake_agent import run_intake_agent
from app.agents.inventory_agent import run_inventory_agent
from app.agents.logistics_agent import run_logistics_agent
from app.config import get_settings
from app.models.schemas import (
    CustomerRow,
    InventoryResult,
    MessageType,
    OrderRow,
    OrderStatus,
)
from app.services import supabase_service, twilio_service
from app.services.log_stream import emit, emit_message
from app.services.glm_client import describe_image, transcribe_audio
from app.services.s3_service import upload_media
from app.services.twilio_service import download_twilio_media

logger = logging.getLogger(__name__)

# Collects every agent message sent during a request — used by mock-chat to return all
# replies as an array so the demo UI can show them progressively.
_msg_collector: ContextVar[list[str] | None] = ContextVar("_msg_collector", default=None)

# ─────────────────────────────────────────
# Serialised inventory write queue (prevents overselling)
# ─────────────────────────────────────────

_inventory_queue: asyncio.Queue = asyncio.Queue()


async def _inventory_worker() -> None:
    while True:
        coro = await _inventory_queue.get()
        try:
            await coro
        except Exception as exc:
            logger.error("Inventory queue worker error: %s", exc)
        finally:
            _inventory_queue.task_done()


_worker_task: Optional[asyncio.Task] = None


def ensure_inventory_worker() -> None:
    global _worker_task
    if _worker_task is None or _worker_task.done():
        try:
            loop = asyncio.get_running_loop()
            _worker_task = loop.create_task(_inventory_worker())
        except RuntimeError:
            pass


# ─────────────────────────────────────────
# Progressive messaging helpers
# ─────────────────────────────────────────

_MS_PARTICLES = {
    "nak", "minta", "boleh", "hantar", "bagi", "saya", "kami", "boss", "lah",
    "la", "ya", "tolong", "barang", "kg", "botol", "beg", "kotak", "unit",
    "order", "pesanan", "stok", "harga",
}


def _detect_language(text: str) -> str:
    words = set(text.lower().split())
    return "ms" if words & _MS_PARTICLES else "en"


def _ack_received(msg_type: MessageType, lang: str) -> str:
    if msg_type == MessageType.AUDIO:
        return "Ok! 🎙️ Saya tengah dengar voice note tu, jap ya..." if lang == "ms" else "Got your voice note! Transcribing now... 🎙️"
    if msg_type == MessageType.IMAGE:
        return "Ok! 🖼️ Tengah baca gambar pesanan tu, jap sekejap..." if lang == "ms" else "Got your image! Reading the order list... 🖼️"
    return "Ok tunggu jap! 🙏 Saya tengah proses pesanan ni..." if lang == "ms" else "On it! 🔍 Processing your order, give me a sec..."


def _ack_checking_stock(lang: str, items_preview: str) -> str:
    if lang == "ms":
        return f"Ok faham! *{items_preview}* — tengah semak stok sekarang 📦"
    return f"Got it! Checking stock for *{items_preview}* now... 📦"


async def _send_intermediate(
    customer: CustomerRow,
    message: str,
    order_id: str | None = None,
) -> None:
    """Send an intermediate status message: WhatsApp + Supabase log + collect for mock-chat."""
    await twilio_service.send_whatsapp_message(customer.whatsapp_number, message)
    await supabase_service.log_message(
        customer_id=customer.customer_id,
        order_id=order_id,
        sender_type="agent",
        message_type="text",
        content=message,
    )
    collector = _msg_collector.get()
    if collector is not None:
        collector.append(message)
    emit_message(message)  # stream to demo chat immediately via SSE


# ─────────────────────────────────────────
# Confirmation keyword detection
# ─────────────────────────────────────────

_AFFIRMATIVE = {"yes", "ya", "yep", "ok", "okay", "confirm", "sahkan", "setuju", "boleh", "ye", "yer", "ok la", "ok lah"}
_NEGATIVE = {"no", "nope", "cancel", "batal", "tidak", "tak", "x", "no la", "cancel la"}


def _is_confirmation(text: str) -> Optional[bool]:
    clean = text.strip().lower().rstrip("!.,")
    if clean in _AFFIRMATIVE or any(clean.startswith(k) for k in _AFFIRMATIVE):
        return True
    if clean in _NEGATIVE or any(clean.startswith(k) for k in _NEGATIVE):
        return False
    return None


# ─────────────────────────────────────────
# Modality pre-processing
# ─────────────────────────────────────────

async def _resolve_to_text(
    message_type: MessageType,
    text_content: Optional[str],
    media_url: Optional[str],
) -> str:
    if message_type == MessageType.TEXT:
        return text_content or ""

    if not media_url:
        return text_content or ""

    media_bytes = await download_twilio_media(media_url)

    if message_type == MessageType.AUDIO:
        await upload_media(media_bytes, "audio/ogg", f"audio/{hash(media_url)}.ogg")
        transcript = await transcribe_audio(media_bytes)
        logger.info("Audio transcribed: %s...", transcript[:100])
        return transcript

    if message_type == MessageType.IMAGE:
        s3_url = await upload_media(media_bytes, "image/jpeg", f"images/{hash(media_url)}.jpg")
        extracted = await describe_image(
            s3_url,
            prompt=(
                "This is a handwritten or printed wholesale order list from Malaysia. "
                "Extract ALL items with their quantities into plain text. "
                "List format: '<product name>: <quantity> <unit>'. "
                "Output ONLY the item list, one per line."
            ),
        )
        logger.info("Image OCR result: %s", extracted[:200])
        return extracted

    return text_content or ""


# ─────────────────────────────────────────
# Core orchestration handlers
# ─────────────────────────────────────────

async def _handle_new_order(
    raw_text: str,
    message_type: MessageType,
    customer: CustomerRow,
    merchant_id: str,
) -> str:
    settings = get_settings()

    # Step 1: Intake Agent
    emit("🧠 [IntakeAgent] Sending message to AI model for parsing...")
    intake = await run_intake_agent(raw_text, merchant_id)
    logger.info(
        "Intake: intent=%s items=%d confidence=%.2f",
        intake.intent, len(intake.items), intake.confidence,
    )
    emit(
        f"🎯 [IntakeAgent] Intent: {intake.intent} | "
        f"Items detected: {len(intake.items)} | "
        f"Confidence: {intake.confidence:.0%}"
    )

    # Non-order intents (or API errors that returned intent="other")
    if intake.intent != "order":
        if intake.clarification_needed and intake.clarification_message:
            # Covers API errors / service-down cases — use the message the agent set
            msg = intake.clarification_message
        else:
            msg = (
                "Hi! I can help you place wholesale orders. "
                "Just send me a message or voice note with what you need and how much. / "
                "Saya boleh bantu terima pesanan borong. Sila hantar mesej atau nota suara dengan butiran pesanan anda."
            )
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            sender_type="agent",
            message_type="text",
            content=msg,
        )
        return msg

    # Low confidence → ask for clarification
    if intake.clarification_needed or intake.confidence < settings.low_confidence_threshold:
        msg = intake.clarification_message or (
            "Could you please clarify your order? I want to make sure I get it right! "
            "/ Boleh nyatakan semula pesanan anda? Saya mahu pastikan segalanya betul!"
        )
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            sender_type="agent",
            message_type="text",
            content=msg,
        )
        return msg

    # Step 1.5: Notify customer we're checking stock
    lang = intake.language_detected or "ms"
    items_preview = ", ".join(
        f"{i.quantity}x {i.product_name}" for i in intake.items
    )
    ack_stock_msg = _ack_checking_stock(lang, items_preview)
    await _send_intermediate(customer, ack_stock_msg)
    emit(f"📱 [WhatsApp] Sent to buyer: \"{ack_stock_msg[:70]}{'…' if len(ack_stock_msg) > 70 else ''}\"")

    # Step 2: Inventory Agent
    emit(f"📦 [InventoryAgent] Checking stock for {len(intake.items)} item(s)...")
    inventory = await run_inventory_agent(intake, merchant_id, intake.language_detected)
    emit(
        f"📦 [InventoryAgent] Stock check complete — "
        f"{'order feasible ✓' if inventory.order_feasible else 'order unfeasible ✗'} | "
        f"Total: RM{inventory.grand_total:.2f}"
    )

    if not inventory.order_feasible or not inventory.items:
        # Use the AI's quote_message if it has one (e.g. explains which items are out of stock)
        # otherwise fall back to a generic message
        fallback = inventory.quote_message or (
            "Maaf, kami tidak dapat memproses pesanan ini sekarang. "
            "Sila cuba lagi sebentar. / "
            "Sorry, we couldn't process this order right now. Please try again in a moment."
        )
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            sender_type="agent",
            message_type="text",
            content=fallback,
        )
        return fallback

    # Persist order in Awaiting Confirmation state
    emit("💾 [DB] Saving order to database...")
    order = await supabase_service.create_order(
        customer_id=customer.customer_id,
        merchant_id=merchant_id,
        order_amount=inventory.grand_total,
        order_notes=f"Items: {', '.join(i.product_name for i in inventory.items)}",
        confidence_score=intake.confidence,
        requires_human_review=intake.confidence < settings.low_confidence_threshold,
        status=OrderStatus.AWAITING_CONFIRMATION,
    )

    await supabase_service.create_order_items(
        order.order_id,
        [
            {
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity": item.fulfilled_qty,
                "unit_price": item.unit_price,
                "is_substituted": item.is_substituted,
            }
            for item in inventory.items
        ],
    )

    import json
    await supabase_service.update_order_status(
        order.order_id,
        OrderStatus.AWAITING_CONFIRMATION,
        order_notes=json.dumps({
            "inventory_result": inventory.model_dump(),
            "intake_result": intake.model_dump(),
            "delivery_address": intake.delivery_address or customer.delivery_address or "",
            "language": intake.language_detected,
        }),
    )

    await supabase_service.log_message(
        customer_id=customer.customer_id,
        order_id=order.order_id,
        sender_type="agent",
        message_type="text",
        content=inventory.quote_message,
    )

    emit(f"✅ [DB] Order {order.order_id[:8]}... saved — status: Awaiting Confirmation")
    emit("📝 [Composer] Generating order quote message for buyer...")
    logger.info("Order %s created, awaiting buyer confirmation", order.order_id)
    return inventory.quote_message


async def _handle_confirmation_reply(
    text: str,
    pending_order: OrderRow,
    customer: CustomerRow,
) -> str:
    decision = _is_confirmation(text)

    if decision is None:
        return (
            "Sorry, I didn't quite catch that. Reply *YES* to confirm your order or *NO* to cancel. "
            "/ Maaf, saya tidak faham. Balas *YA* untuk sahkan atau *TIDAK* untuk batal."
        )

    if decision is False:
        await supabase_service.update_order_status(pending_order.order_id, OrderStatus.EXPIRED)
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            order_id=pending_order.order_id,
            sender_type="agent",
            message_type="text",
            content="Order cancelled. / Pesanan dibatalkan.",
        )
        return (
            "Order cancelled. Feel free to place a new order anytime! 😊 "
            "/ Pesanan dibatalkan. Boleh buat pesanan baru bila-bila masa! 😊"
        )

    # YES — run logistics
    import json as _json
    raw_notes = pending_order.order_notes or "{}"
    try:
        notes_data = _json.loads(raw_notes)
        inventory_data = notes_data.get("inventory_result", {})
        delivery_address = notes_data.get("delivery_address", "") or customer.delivery_address or ""
        language = notes_data.get("language", "mixed")
    except Exception:
        inventory_data = {}
        delivery_address = customer.delivery_address or ""
        language = "mixed"

    from app.models.schemas import InventoryResult
    try:
        inv_result = InventoryResult(**inventory_data)
    except Exception:
        inv_result = InventoryResult(
            order_feasible=True, items=[], total_amount=0,
            grand_total=pending_order.order_amount or 0,
            quote_message="", delivery_fee=15.0,
        )

    await supabase_service.update_order_status(pending_order.order_id, OrderStatus.CONFIRMED)

    async def _do_logistics():
        logistics = await run_logistics_agent(pending_order, inv_result, delivery_address, language)
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            order_id=pending_order.order_id,
            sender_type="agent",
            message_type="text",
            content=logistics.confirmation_message,
        )
        await twilio_service.send_whatsapp_message(customer.whatsapp_number, logistics.confirmation_message)

    _inventory_queue.put_nowait(_do_logistics())
    ensure_inventory_worker()

    ack = (
        "✅ Dapat! Tengah sahkan pesanan dan atur penghantaran... "
        "Kejap lagi dapat konfirmasi dengan tracking! 🚚\n"
        "/ ✅ Got it! Confirming your order and arranging delivery... "
        "You'll get tracking info shortly!"
    )
    await supabase_service.log_message(
        customer_id=customer.customer_id,
        order_id=pending_order.order_id,
        sender_type="agent",
        message_type="text",
        content=ack,
    )
    return ack


# ─────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────

async def handle_incoming_message(
    from_number: str,
    message_type: MessageType,
    text_content: Optional[str],
    media_url: Optional[str],
    merchant_id: str,
) -> str:
    ensure_inventory_worker()

    # 1. Get or create customer
    emit(f"👤 [CRM] Looking up customer: {from_number}...")
    customer = await supabase_service.get_or_create_customer(from_number, merchant_id)
    emit(f"👤 [CRM] Customer found — ID ...{customer.customer_id[-8:]}")

    # 2. Log inbound message
    await supabase_service.log_message(
        customer_id=customer.customer_id,
        sender_type="buyer",
        message_type=message_type.value,
        content=text_content or "",
        media_url=media_url,
    )

    # 3. Check for pending order (Awaiting Confirmation state)
    emit("📋 [State] Checking for pending confirmation orders...")
    pending_order = await supabase_service.get_pending_order(customer.customer_id)

    if pending_order:
        emit(f"📋 [State] Pending order found — {pending_order.order_id[:8]}... awaiting confirmation reply")
        raw_text = await _resolve_to_text(message_type, text_content, media_url)
        final = await _handle_confirmation_reply(raw_text, pending_order, customer)
    else:
        emit("📋 [State] No pending order — treating as new order request")
        # Send immediate ack so the customer knows we received their message
        lang = _detect_language(text_content or "")
        await _send_intermediate(customer, _ack_received(message_type, lang))

        # 4. Pre-process media to text
        raw_text = await _resolve_to_text(message_type, text_content, media_url)

        if not raw_text.strip():
            final = (
                "Hi! 👋 I'm SupplyLah — send me your order as a text message, voice note, or photo of your order list. "
                "/ Halo! Saya SupplyLah — hantar pesanan anda sebagai mesej, nota suara, atau gambar senarai pesanan."
            )
        else:
            # 5. Process as new order
            final = await _handle_new_order(raw_text, message_type, customer, merchant_id)

    # Add the final reply to the mock-chat collector (if active)
    collector = _msg_collector.get()
    if collector is not None and final not in collector:
        collector.append(final)

    return final
