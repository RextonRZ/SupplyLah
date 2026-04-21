"""Main orchestrator — stateful message router and workflow state machine.

Flow:
  Incoming message → lookup customer → check pending order state →
    NEW: Intake → Inventory → save quote → set Awaiting Confirmation
    AWAITING CONFIRMATION: detect YES/NO → Logistics | Expire
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from app.agents.intake_agent import run_intake_agent
from app.agents.inventory_agent import run_inventory_agent
from app.agents.logistics_agent import run_logistics_agent
from app.config import get_settings
from app.models.schemas import (
    CustomerRow,
    InventoryResult,
    OrderRow,
    OrderStatus,
    MessageType,
)
from app.services import supabase_service, twilio_service
from app.services.glm_client import describe_image, transcribe_audio
from app.services.s3_service import upload_media
from app.services.twilio_service import download_twilio_media

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────
# Serialised inventory write queue (prevents overselling)
# ─────────────────────────────────────────

_inventory_queue: asyncio.Queue = asyncio.Queue()


async def _inventory_worker() -> None:
    """Background worker — processes inventory deductions one at a time."""
    while True:
        coro = await _inventory_queue.get()
        try:
            await coro
        except Exception as exc:
            logger.error("Inventory queue worker error: %s", exc)
        finally:
            _inventory_queue.task_done()


# Start worker on first import (FastAPI lifespan handles this properly in main.py)
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
# Confirmation keyword detection
# ─────────────────────────────────────────

_AFFIRMATIVE = {"yes", "ya", "yep", "ok", "okay", "confirm", "sahkan", "setuju", "boleh", "ye", "yer", "ok la", "ok lah"}
_NEGATIVE = {"no", "nope", "cancel", "batal", "tidak", "tak", "x", "no la", "cancel la"}


def _is_confirmation(text: str) -> Optional[bool]:
    """Returns True for yes, False for no, None if ambiguous."""
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
    """Convert any input modality to plain text for agent processing."""
    if message_type == MessageType.TEXT:
        return text_content or ""

    if not media_url:
        return text_content or ""

    media_bytes = await download_twilio_media(media_url)

    if message_type == MessageType.AUDIO:
        s3_url = await upload_media(media_bytes, "audio/ogg", f"audio/{hash(media_url)}.ogg")
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
    """Run Intake → Inventory pipeline for a new order."""
    settings = get_settings()

    # Step 1: Intake Agent
    intake = await run_intake_agent(raw_text, merchant_id)
    logger.info(
        "Intake: intent=%s items=%d confidence=%.2f",
        intake.intent, len(intake.items), intake.confidence,
    )

    # Non-order intents
    if intake.intent != "order":
        return (
            "Hi! I can help you place wholesale orders. "
            "Just send me a message or voice note with what you need and how much. / "
            "Saya boleh bantu terima pesanan borong. Sila hantar mesej atau nota suara dengan butiran pesanan anda."
        )

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

    # Step 2: Inventory Agent
    inventory = await run_inventory_agent(intake, merchant_id, intake.language_detected)

    if not inventory.order_feasible or not inventory.items:
        fallback = (
            "Sorry, we're unable to fulfil this order right now. "
            "Please contact us directly for assistance."
        )
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            sender_type="agent",
            message_type="text",
            content=fallback,
        )
        return fallback

    # Persist order in Awaiting Confirmation state
    order = await supabase_service.create_order(
        customer_id=customer.customer_id,
        merchant_id=merchant_id,
        order_amount=inventory.grand_total,
        order_notes=f"Items: {', '.join(i.product_name for i in inventory.items)}",
        confidence_score=intake.confidence,
        requires_human_review=intake.confidence < settings.low_confidence_threshold,
        status=OrderStatus.AWAITING_CONFIRMATION,
    )

    # Persist order items
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

    # Store inventory result in order notes for retrieval at confirmation
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

    logger.info("Order %s created, awaiting buyer confirmation", order.order_id)
    return inventory.quote_message


async def _handle_confirmation_reply(
    text: str,
    pending_order: OrderRow,
    customer: CustomerRow,
) -> str:
    """Process a buyer's reply to a pending quote."""
    decision = _is_confirmation(text)

    if decision is None:
        # Ambiguous reply — ask again
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
        intake_data = notes_data.get("intake_result", {})
        delivery_address = notes_data.get("delivery_address", "") or customer.delivery_address or ""
        language = notes_data.get("language", "mixed")
    except Exception:
        inventory_data = {}
        intake_data = {}
        delivery_address = customer.delivery_address or ""
        language = "mixed"

    # Reconstruct InventoryResult from stored JSON
    from app.models.schemas import InventoryResult, ResolvedOrderItem
    try:
        inv_result = InventoryResult(**inventory_data)
    except Exception:
        inv_result = InventoryResult(
            order_feasible=True, items=[], total_amount=0,
            grand_total=pending_order.order_amount or 0,
            quote_message="", delivery_fee=15.0,
        )

    await supabase_service.update_order_status(pending_order.order_id, OrderStatus.CONFIRMED)

    # Enqueue logistics via the serial inventory worker
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

    # Immediate acknowledgement while logistics processes in background
    ack = (
        "✅ Got it! Confirming your order and arranging delivery... "
        "You'll receive a confirmation with tracking shortly!\n"
        "/ ✅ Pesanan disahkan! Sedang atur penghantaran... "
        "Anda akan terima butiran pengesahan dan tracking tidak lama lagi!"
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
    """Main entry point called by the Twilio webhook handler.

    Returns the message string to send back to the buyer.
    """
    ensure_inventory_worker()

    # 1. Get or create customer
    customer = await supabase_service.get_or_create_customer(from_number, merchant_id)

    # 2. Log inbound message
    await supabase_service.log_message(
        customer_id=customer.customer_id,
        sender_type="buyer",
        message_type=message_type.value,
        content=text_content or "",
        media_url=media_url,
    )

    # 3. Check for pending order (Awaiting Confirmation state)
    pending_order = await supabase_service.get_pending_order(customer.customer_id)

    if pending_order:
        raw_text = await _resolve_to_text(message_type, text_content, media_url)
        return await _handle_confirmation_reply(raw_text, pending_order, customer)

    # 4. Pre-process media to text
    raw_text = await _resolve_to_text(message_type, text_content, media_url)

    if not raw_text.strip():
        return (
            "Hi! 👋 I'm SupplyLah — send me your order as a text message, voice note, or photo of your order list. "
            "/ Halo! Saya SupplyLah — hantar pesanan anda sebagai mesej, nota suara, atau gambar senarai pesanan."
        )

    # 5. Process as new order
    return await _handle_new_order(raw_text, message_type, customer, merchant_id)
