"""Main orchestrator — stateful message router and workflow state machine.

Flow:
  Incoming message → lookup customer → check pending order state →
    NEW: immediate ack → Intake → "checking stock" → Inventory →
      if substitution needed → Awaiting Substitution → ask buyer → YES/NO → quote
      no substitution → save quote → Awaiting Confirmation
    AWAITING SUBSTITUTION: detect YES/NO → generate quote → Awaiting Confirmation | Expire
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
    ResolvedOrderItem,
)
from app.services import supabase_service, twilio_service
from app.services.log_stream import emit, emit_message
from app.services.glm_client import describe_image, transcribe_audio
from app.services.s3_service import upload_media, generate_presigned_url 
from app.services.transcription_service import transcribe_audio_from_url
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
    "nak", "nk", "minta", "boleh", "hantar", "bagi", "saya", "kami", "boss",
    "lah", "la", "ya", "yea", "tolong", "barang", "kg", "botol", "beg",
    "kotak", "unit", "order", "pesanan", "stok", "harga", "jap", "ok",
    "ni", "tu", "dengan", "untuk", "dan", "ke", "dari", "ekor", "biji",
    "sahaja", "je", "je", "dah", "tak", "tahu", "tau", "faham", "betul",
    "terima", "kasih", "maaf", "selamat", "jalan", "taman", "lorong",
}

# English-only markers — if any appear, lean English
_EN_MARKERS = {
    "please", "want", "need", "send", "deliver", "thank", "hello", "hi",
    "yes", "no", "cancel", "confirm", "address", "total", "price", "how",
    "i", "we", "the", "is", "are", "can", "do", "only", "have", "left",
}


def _detect_language(text: str) -> str:
    words = set(text.lower().split())
    ms_hits = len(words & _MS_PARTICLES)
    en_hits = len(words & _EN_MARKERS)
    if ms_hits > en_hits:
        return "ms"
    if en_hits > ms_hits:
        return "en"
    # Ambiguous (short messages like "60", "YA", numbers, addresses) —
    # default to Malay since this is a Malaysian wholesale platform
    return "ms"


def _ack_received(msg_type: MessageType, lang: str) -> str:
    if msg_type == MessageType.AUDIO:
        return "Ok! 🎙️ Saya tengah dengar voice note tu, jap ya..." if lang == "ms" else "Got your voice note! Transcribing now... 🎙️"
    if msg_type == MessageType.IMAGE:
        return "Ok! 🖼️ Tengah baca gambar pesanan tu, jap sekejap..." if lang == "ms" else "Got your image! Reading the order list... 🖼️"
    return "Ok tunggu jap! 🙏 Saya tengah proses pesanan ni..." if lang == "ms" else "On it! 🔍 Processing your order, give me a sec..."


def _ack_checking_stock(lang: str, items: list) -> str:
    bullets = "\n".join(f"• *{i.product_name}* x{i.quantity}" for i in items)
    if lang == "ms":
        return f"Ok faham! Tengah semak stok sekarang 📦\n\n{bullets}"
    return f"Got it! Checking stock now 📦\n\n{bullets}"


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
# Substitution ask & reply helpers
# ─────────────────────────────────────────

def _build_substitution_question(lang: str, sub_items: list[ResolvedOrderItem]) -> str:
    """Format a clear substitution proposal for the buyer."""
    if lang == "ms":
        if len(sub_items) == 1:
            s = sub_items[0]
            orig = s.original_product_name or s.product_name
            disc = f" pada diskaun *{s.discount_pct:.0f}%*" if s.discount_pct else ""
            return (
                f"Maaf, stok *{orig}* tidak mencukupi.\n\n"
                f"Kami boleh cadangkan *{s.product_name}* sebagai pengganti{disc}.\n\n"
                f"Setuju? Balas *YA* untuk terima atau *TIDAK* untuk tanggalkan item ini."
            )
        lines = ["Maaf, beberapa item perlu penggantian:\n"]
        for s in sub_items:
            orig = s.original_product_name or s.product_name
            disc = f" (diskaun {s.discount_pct:.0f}%)" if s.discount_pct else ""
            lines.append(f"• *{orig}* → *{s.product_name}*{disc}")
        lines.append(
            "\nSetuju dengan semua penggantian ini?\n"
            "Balas *YA* untuk terima atau *TIDAK* untuk tanggalkan item-item ini."
        )
        return "\n".join(lines)
    else:
        if len(sub_items) == 1:
            s = sub_items[0]
            orig = s.original_product_name or s.product_name
            disc = f" at *{s.discount_pct:.0f}% off*" if s.discount_pct else ""
            return (
                f"Sorry, we have a shortage on *{orig}*.\n\n"
                f"We can swap it with *{s.product_name}*{disc}. "
                f"Is that ok with you or would you like to remove this item?"
            )
        lines = ["Sorry, we have shortages on some items:\n"]
        for s in sub_items:
            orig = s.original_product_name or s.product_name
            disc = f" ({s.discount_pct:.0f}% off)" if s.discount_pct else ""
            lines.append(f"• *{orig}* → *{s.product_name}*{disc}")
        lines.append(
            "\nOk with all substitutions? "
            "Reply *YES* to accept or *NO* to remove these items."
        )
        return "\n".join(lines)


def _build_quote_message(lang: str, inv: InventoryResult) -> str:
    """Build the order summary message without a second LLM call."""
    lines = []
    partial_warnings = []

    # Prepend out-of-stock notices before the order summary
    if inv.out_of_stock_items:
        for name in inv.out_of_stock_items:
            if lang == "ms":
                lines.append(f"⚠️ Maaf, *{name}* tiada dalam stok buat masa ini dan tidak dapat disertakan dalam pesanan.")
            else:
                lines.append(f"⚠️ Sorry, *{name}* is currently out of stock and could not be included in your order.")
        lines.append("")

    if lang == "ms":
        lines.append("Berikut ringkasan pesanan anda:\n")
        for item in inv.items:
            note = " (pengganti)" if item.is_substituted else ""
            lines.append(f"• *{item.product_name}*{note} x{item.fulfilled_qty} — RM{item.line_total:.2f}")
            if item.requested_qty and item.fulfilled_qty < item.requested_qty:
                partial_warnings.append(
                    f"⚠️ Malangnya, kami hanya ada *{item.fulfilled_qty} unit* {item.product_name} sahaja "
                    f"(anda minta {item.requested_qty}). Adakah anda masih mahu membeli {item.fulfilled_qty} unit yang ada?"
                )
        if partial_warnings:
            lines.append("")
            lines.extend(partial_warnings)
        if inv.discount_applied:
            lines.append(f"\nDiskaun: -RM{inv.discount_applied:.2f}")
        lines.append(f"Penghantaran: RM{inv.delivery_fee:.2f}")
        lines.append(f"*Jumlah: RM{inv.grand_total:.2f}*")
        lines.append("\nBalas *YA* untuk sahkan atau *TIDAK* untuk batal 😊")
    else:
        lines.append("Here's your order summary:\n")
        for item in inv.items:
            note = " (substitute)" if item.is_substituted else ""
            lines.append(f"• *{item.product_name}*{note} x{item.fulfilled_qty} — RM{item.line_total:.2f}")
            if item.requested_qty and item.fulfilled_qty < item.requested_qty:
                partial_warnings.append(
                    f"⚠️ Unfortunately, we only have *{item.fulfilled_qty} units* of {item.product_name} left "
                    f"(you requested {item.requested_qty}). Do you still want to purchase the remaining {item.fulfilled_qty}?"
                )
        if partial_warnings:
            lines.append("")
            lines.extend(partial_warnings)
        if inv.discount_applied:
            lines.append(f"\nDiscount: -RM{inv.discount_applied:.2f}")
        lines.append(f"Delivery: RM{inv.delivery_fee:.2f}")
        lines.append(f"*Total: RM{inv.grand_total:.2f}*")
        lines.append("\nReply *YES* to confirm or *NO* to cancel 😊")
    return "\n".join(lines)


async def _handle_substitution_reply(
    text: str,
    pending_order: OrderRow,
    customer: CustomerRow,
) -> str:
    import json as _json
    decision = _is_confirmation(text)
    raw_notes = pending_order.order_notes or "{}"
    try:
        notes_data = _json.loads(raw_notes)
    except Exception:
        notes_data = {}

    inventory_data = notes_data.get("inventory_result", {})
    language = notes_data.get("language", "ms")

    if decision is None:
        if language == "ms":
            return "Maaf, saya tidak faham. Balas *YA* untuk terima penggantian atau *TIDAK* untuk tanggalkan item tersebut."
        return "Sorry, I didn't catch that. Reply *YES* to accept the substitution or *NO* to remove it."

    try:
        inv_result = InventoryResult(**inventory_data)
    except Exception:
        await supabase_service.update_order_status(pending_order.order_id, OrderStatus.EXPIRED)
        return "Sorry, there was an issue with your order. Please send your order again."

    if decision is False:
        # Remove substituted items, recalculate
        kept_items = [i for i in inv_result.items if not i.is_substituted]
        if not kept_items:
            await supabase_service.update_order_status(pending_order.order_id, OrderStatus.EXPIRED)
            if language == "ms":
                msg = "Ok, pesanan anda telah dibatalkan kerana tiada item yang boleh diproses. Hantar pesanan baru bila-bila masa! 😊"
            else:
                msg = "Ok, your order has been cancelled as no items could be fulfilled. Feel free to order again anytime! 😊"
            await supabase_service.log_message(
                customer_id=customer.customer_id,
                order_id=pending_order.order_id,
                sender_type="agent",
                message_type="text",
                content=msg,
            )
            return msg

        total = sum(i.line_total for i in kept_items)
        grand = total + inv_result.delivery_fee - inv_result.discount_applied
        inv_result = InventoryResult(
            order_feasible=True,
            items=kept_items,
            total_amount=total,
            discount_applied=inv_result.discount_applied,
            delivery_fee=inv_result.delivery_fee,
            grand_total=grand,
            quote_message="",
            requires_substitution=False,
        )

    # YES (or NO-but-kept-items): generate quote and move to Awaiting Confirmation
    quote_msg = _build_quote_message(language, inv_result)

    await supabase_service.update_order_status(
        pending_order.order_id,
        OrderStatus.AWAITING_CONFIRMATION,
        order_notes=_json.dumps({
            **notes_data,
            "inventory_result": inv_result.model_dump(),
        }),
    )
    await supabase_service.create_order_items(
        pending_order.order_id,
        [
            {
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity": item.fulfilled_qty,
                "unit_price": item.unit_price,
                "is_substituted": item.is_substituted,
            }
            for item in inv_result.items
        ],
    )
    await supabase_service.log_message(
        customer_id=customer.customer_id,
        order_id=pending_order.order_id,
        sender_type="agent",
        message_type="text",
        content=quote_msg,
    )
    emit(f"📝 [Substitution] Customer {'accepted' if decision else 'declined'} substitution — quote generated")
    return quote_msg


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

_IMAGE_OCR_PROMPT = (
    "This is a Malaysian SME wholesale order list — it may be handwritten, printed, or a photo of a whiteboard. "
    "The language is Bahasa Melayu, English, or a mix (Bahasa Rojak). "
    "Common abbreviations: 'ctn'=carton, 'kg'=kilogram, 'pkt'=packet, 'btl'=bottle, 'tin'=tin, 'guni'=sack, 'kotak'=box. "
    "Extract EVERY item and its quantity. "
    "Output format — one item per line: '<product name>: <quantity> <unit>'. "
    "If quantity is unclear write '?'. Output ONLY the item list, no extra text."
)

async def _resolve_to_text(
    message_type: MessageType,
    text_content: Optional[str],
    media_url: Optional[str],
    media_content: Optional[str] = None,
    media_content_type: str = "image/jpeg",
) -> str:
    if message_type == MessageType.TEXT:
        return text_content or ""

    if message_type == MessageType.IMAGE:
        # Mock-chat path: base64 image sent directly from frontend
        if media_content:
            data_uri = f"data:{media_content_type};base64,{media_content}"
            emit("🖼️ [OCR] Extracting order items from image via Gemini Vision...")
            extracted = await describe_image(data_uri, _IMAGE_OCR_PROMPT)
            logger.info("Image OCR result (base64): %s", extracted[:200])
            emit(f"✅ [OCR] Extracted: {extracted[:120]}{'…' if len(extracted) > 120 else ''}")
            return extracted

        # Real Twilio path: download from URL then upload to S3
        if media_url:
            media_bytes = await download_twilio_media(media_url)
            s3_url = await upload_media(media_bytes, "image/jpeg", f"images/{hash(media_url)}.jpg")
            emit("🖼️ [OCR] Extracting order items from image via Gemini Vision...")
            extracted = await describe_image(s3_url, _IMAGE_OCR_PROMPT)
            logger.info("Image OCR result: %s", extracted[:200])
            return extracted

        return text_content or ""

    if not media_url:
        return text_content or ""

    media_bytes = await download_twilio_media(media_url)

    if message_type == MessageType.AUDIO:
        key = f"audio/{hash(media_url)}.ogg"
        await upload_media(media_bytes, "audio/ogg", key)
        presigned_url = await generate_presigned_url(key)
        result = await transcribe_audio_from_url(presigned_url, "audio/ogg")
        transcript = result["transcript"]
        logger.info("Audio transcribed via Groq: %s", transcript[:100])
        return transcript

    return text_content or ""


# ─────────────────────────────────────────
# Inquiry handler — answers questions using live context
# ─────────────────────────────────────────

async def _handle_inquiry(
    question: str,
    merchant_id: str,
    lang: str,
) -> str:
    """Answer a customer inquiry by injecting live stock + business rules into one LLM call."""
    import asyncio as _asyncio
    from app.services.glm_client import run_agent_loop

    settings = get_settings()
    emit("💬 [InquiryAgent] Loading context for inquiry...")

    products, business_rules = await _asyncio.gather(
        supabase_service.get_products(merchant_id),
        supabase_service.get_knowledge_base_rules(merchant_id),
    )

    import json as _json
    stock_summary = _json.dumps(
        [
            {
                "product_name": p.product_name,
                "unit_price": p.unit_price,
                "stock_quantity": p.stock_quantity,
                "aliases": p.slang_aliases,
            }
            for p in products
        ],
        ensure_ascii=False,
    )

    lang_instruction = "Reply in Bahasa Melayu (Malay)." if lang == "ms" else "Reply in English."

    system = (
        "You are a helpful customer service assistant for a Malaysian wholesale business called SupplyLah. "
        "Answer the customer's question concisely and honestly using only the information provided. "
        "Do not make up products, prices, or rules that are not listed. "
        f"{lang_instruction} "
        "Keep the reply short — 1 to 3 sentences. Use *bold* for key numbers or product names. "
        "Do not use more than 1 emoji."
        f"\n\nCurrent stock:\n{stock_summary}"
        f"\n\nBusiness rules:\n{business_rules or 'No specific rules configured.'}"
    )

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": question},
    ]

    emit("🤖 [InquiryAgent] Calling AI model...")
    try:
        answer = await run_agent_loop(
            model=settings.model_reasoning,
            messages=messages,
            tools=[],
            tool_executors={},
        )
        emit("✅ [InquiryAgent] Answer ready")
        return answer.strip() or (
            "Maaf, saya tidak dapat menjawab soalan itu sekarang." if lang == "ms"
            else "Sorry, I couldn't answer that right now."
        )
    except Exception as exc:
        logger.error("Inquiry agent error: %s", exc)
        return (
            "Maaf, sistem kami sibuk sekarang. Cuba lagi dalam seminit ya! 🙏" if lang == "ms"
            else "Sorry, our system is busy right now. Please try again in a minute! 🙏"
        )


# ─────────────────────────────────────────
# Previous order reference handler
# ─────────────────────────────────────────

async def _handle_previous_order_reference(
    raw_text: str,
    customer: CustomerRow,
    merchant_id: str,
    lang: str,
) -> str:
    """Handle when buyer references a past order (e.g. 'same as yesterday')."""
    import json as _json

    emit("🔄 [Orchestrator] Buyer references previous order — fetching last order...")
    last_order = await supabase_service.get_last_confirmed_order(customer.customer_id)

    if not last_order or not last_order.get("order_item"):
        if lang == "ms":
            msg = "Maaf, saya tidak jumpa rekod pesanan lepas anda. Boleh nyatakan semula item yang anda mahu pesan? 😊"
        else:
            msg = "Sorry, I couldn't find your previous order. Could you please list the items you'd like to order? 😊"
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            sender_type="agent",
            message_type="text",
            content=msg,
        )
        return msg

    items = last_order["order_item"]
    item_lines = "\n".join(
        f"• *{it['product_name']}* — {it['quantity']} unit" for it in items
    )

    # Detect vague quantity modifiers (e.g. "lebih sikit", "more", "tambah")
    _MORE_KEYWORDS = {"lebih", "tambah", "more", "extra", "sikit", "banyak", "kurang", "less"}
    raw_lower = set(raw_text.lower().split())
    has_vague_modifier = bool(raw_lower & _MORE_KEYWORDS)

    # Save a Pending order with repeat_order metadata so we can intercept the buyer's reply
    order = await supabase_service.create_order(
        customer_id=customer.customer_id,
        merchant_id=merchant_id,
        order_amount=0,
        order_notes=_json.dumps({
            "repeat_order": True,
            "previous_items": items,
            "has_vague_modifier": has_vague_modifier,
            "language": lang,
        }),
        confidence_score=0.8,
        requires_human_review=False,
        status=OrderStatus.PENDING,
    )

    if lang == "ms":
        if has_vague_modifier:
            msg = (
                f"Helo {customer.customer_name or ''}! Saya nampak anda mahu buat pesanan macam sebelumnya.\n\n"
                f"Pesanan lepas anda:\n{item_lines}\n\n"
                f"Boleh nyatakan item mana dan berapa banyak yang anda mahu ubah? 😊"
            )
        else:
            msg = (
                f"Helo {customer.customer_name or ''}! Saya nampak anda mahu repeat pesanan lepas.\n\n"
                f"Pesanan lepas anda:\n{item_lines}\n\n"
                f"Setuju untuk order sekali lagi dengan kuantiti yang sama? Balas *YA* atau *TIDAK*."
            )
    else:
        if has_vague_modifier:
            msg = (
                f"Hey {customer.customer_name or ''}! Looks like you'd like to reorder with some changes.\n\n"
                f"Your last order:\n{item_lines}\n\n"
                f"Could you let me know which items and how much more you'd like? 😊"
            )
        else:
            msg = (
                f"Hey {customer.customer_name or ''}! Looks like you'd like to repeat your previous order.\n\n"
                f"Your last order:\n{item_lines}\n\n"
                f"Shall I go ahead with the same quantities? Reply *YES* or *NO*."
            )

    emit("📋 [Orchestrator] Asked buyer to confirm/refine previous order")
    await supabase_service.log_message(
        customer_id=customer.customer_id,
        order_id=order.order_id,
        sender_type="agent",
        message_type="text",
        content=msg,
    )
    return msg


async def _handle_address_reply(
    raw_text: str,
    address_order: OrderRow,
    customer: CustomerRow,
    merchant_id: str,
) -> str:
    """Buyer just replied with their delivery address — resume order flow."""
    import json as _json
    emit("📍 [Orchestrator] Address received — resuming order flow...")
    try:
        notes_data = _json.loads(address_order.order_notes or "{}")
    except Exception:
        notes_data = {}

    lang = notes_data.get("language", "ms")
    intake_data = notes_data.get("intake_result", {})

    # Expire the address placeholder order
    await supabase_service.update_order_status(address_order.order_id, OrderStatus.EXPIRED)

    # Rebuild IntakeResult from saved data, inject the new address
    from app.models.schemas import IntakeResult, OrderLineItem
    try:
        items = [OrderLineItem(**i) for i in intake_data.get("items", [])]
        intake = IntakeResult(
            intent="order",
            items=items,
            delivery_address=raw_text.strip(),
            language_detected=lang,
            confidence=float(intake_data.get("confidence", 0.85)),
        )
    except Exception:
        if lang == "ms":
            msg = "Maaf, ada masalah dengan pesanan anda. Boleh hantar semula pesanan anda? 😊"
        else:
            msg = "Sorry, something went wrong. Could you resend your order? 😊"
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            sender_type="agent",
            message_type="text",
            content=msg,
        )
        return msg

    # Continue with inventory check
    ack = _ack_checking_stock(lang, intake.items)
    await _send_intermediate(customer, ack)

    emit(f"📦 [InventoryAgent] Checking stock for {len(intake.items)} item(s)...")
    inventory = await run_inventory_agent(intake, merchant_id, lang)

    if not inventory.order_feasible or not inventory.items:
        item_names = ", ".join(f"*{i.product_name}*" for i in intake.items)
        if lang == "ms":
            msg = (f"Maaf, {item_names} sudah habis stok 😔\n\nBalas *YA* untuk terima notifikasi bila stok ada.")
        else:
            msg = (f"Sorry, {item_names} is out of stock 😔\n\nReply *YES* to be notified when restocked.")
        await supabase_service.log_message(
            customer_id=customer.customer_id, sender_type="agent", message_type="text", content=msg,
        )
        return msg

    import json as _json2
    sub_items = [i for i in inventory.items if i.is_substituted]
    if sub_items:
        order = await supabase_service.create_order(
            customer_id=customer.customer_id, merchant_id=merchant_id,
            order_amount=inventory.grand_total, order_notes="",
            confidence_score=intake.confidence, requires_human_review=False,
            status=OrderStatus.AWAITING_SUBSTITUTION,
        )
        await supabase_service.update_order_status(
            order.order_id, OrderStatus.AWAITING_SUBSTITUTION,
            order_notes=_json2.dumps({
                "inventory_result": inventory.model_dump(),
                "intake_result": intake.model_dump(),
                "delivery_address": raw_text.strip(),
                "language": lang,
            }),
        )
        question = _build_substitution_question(lang, sub_items)
        await supabase_service.log_message(
            customer_id=customer.customer_id, order_id=order.order_id,
            sender_type="agent", message_type="text", content=question,
        )
        return question

    # Save confirmed order
    order = await supabase_service.create_order(
        customer_id=customer.customer_id, merchant_id=merchant_id,
        order_amount=inventory.grand_total, order_notes="",
        confidence_score=intake.confidence,
        requires_human_review=intake.confidence < get_settings().low_confidence_threshold,
        status=OrderStatus.AWAITING_CONFIRMATION,
    )
    await supabase_service.create_order_items(order.order_id, [
        {"product_id": i.product_id, "product_name": i.product_name,
         "quantity": i.fulfilled_qty, "unit_price": i.unit_price, "is_substituted": i.is_substituted}
        for i in inventory.items
    ])
    await supabase_service.update_order_status(
        order.order_id, OrderStatus.AWAITING_CONFIRMATION,
        order_notes=_json2.dumps({
            "inventory_result": inventory.model_dump(),
            "intake_result": intake.model_dump(),
            "delivery_address": raw_text.strip(),
            "language": lang,
        }),
        order_amount=inventory.grand_total,
        confidence_score=intake.confidence,
    )
    quote = _build_quote_message(lang, inventory)
    await supabase_service.log_message(
        customer_id=customer.customer_id, order_id=order.order_id,
        sender_type="agent", message_type="text", content=quote,
    )
    emit(f"✅ [DB] Order {order.order_id[:8]}... saved — status: Awaiting Confirmation")
    return quote


async def _handle_restock_reply(
    raw_text: str,
    restock_order: OrderRow,
    customer: CustomerRow,
) -> str:
    import json as _json
    try:
        notes_data = _json.loads(restock_order.order_notes or "{}")
    except Exception:
        notes_data = {}
    lang = notes_data.get("language", "ms")
    items = notes_data.get("items", "the item(s)")

    decision = _is_confirmation(raw_text)
    await supabase_service.update_order_status(restock_order.order_id, OrderStatus.EXPIRED)

    if decision is True:
        if lang == "ms":
            msg = f"Terima kasih! Kami akan hubungi anda apabila {items} telah diisi semula 📦 Selamat menunggu!"
        else:
            msg = f"Got it! We'll message you when {items} is back in stock 📦 Stay tuned!"
    elif decision is False:
        if lang == "ms":
            msg = "Ok, tiada masalah! Hubungi kami bila-bila masa untuk membuat pesanan baru 😊"
        else:
            msg = "No problem! Feel free to place a new order anytime 😊"
    else:
        if lang == "ms":
            msg = "Maaf, saya tidak faham. Balas *YA* jika nak kami maklumkan bila stok ada, atau *TIDAK* untuk batal."
        else:
            msg = "Sorry, I didn't catch that. Reply *YES* to be notified when back in stock, or *NO* to cancel."
        return msg

    await supabase_service.log_message(
        customer_id=customer.customer_id,
        order_id=restock_order.order_id,
        sender_type="agent",
        message_type="text",
        content=msg,
    )
    return msg


async def _handle_repeat_order_reply(
    raw_text: str,
    repeat_order: OrderRow,
    customer: CustomerRow,
    merchant_id: str,
) -> str:
    """Handle buyer's reply after being asked about their repeat order.

    Three scenarios:
    1. Vague modifier was flagged + buyer specifies changes → merge & run inventory
    2. No modifier + buyer says YES → run inventory with previous items as-is
    3. Buyer says NO → cancel
    """
    import json as _json

    try:
        notes_data = _json.loads(repeat_order.order_notes or "{}")
    except Exception:
        notes_data = {}

    previous_items = notes_data.get("previous_items", [])
    has_vague_modifier = notes_data.get("has_vague_modifier", False)
    language = notes_data.get("language", "ms")
    lang = language or _detect_language(raw_text)
    
    if repeat_order.requires_human_review:
        msg = (
            "Sila tunggu sebentar, ejen manusia kami sedang menyemak pesanan anda dan akan membalas tidak lama lagi! 🙏" if lang == "ms"
            else "Please wait a moment, our human agent is reviewing your order and will be with you shortly! 🙏"
        )
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            order_id=repeat_order.order_id,
            sender_type="agent",
            message_type="text",
            content=msg,
        )
        return msg

    # If no vague modifier, treat as a YES/NO confirmation
    if not has_vague_modifier:
        decision = _is_confirmation(raw_text)
        if decision is None:
            if lang == "ms":
                return "Maaf, saya tidak faham. Balas *YA* untuk sahkan atau *TIDAK* untuk batal."
            return "Sorry, I didn't catch that. Reply *YES* to confirm or *NO* to cancel."
        if decision is False:
            await supabase_service.update_order_status(repeat_order.order_id, OrderStatus.EXPIRED)
            if lang == "ms":
                msg = "Ok, pesanan dibatalkan. Boleh buat pesanan baru bila-bila masa! 😊"
            else:
                msg = "Ok, order cancelled. Feel free to place a new order anytime! 😊"
            await supabase_service.log_message(
                customer_id=customer.customer_id,
                order_id=repeat_order.order_id,
                sender_type="agent",
                message_type="text",
                content=msg,
            )
            return msg
        # YES — proceed with previous items as-is
        merged_items = previous_items
    else:
        # Buyer is specifying modifications — use LLM to merge their reply with previous items
        merge_result = await _merge_repeat_modifications(raw_text, previous_items)
        
        # Ambiguous and escalation
        if merge_result.get("status") == "ambiguous":
            clarification_count = notes_data.get("clarification_count", 0) + 1
            
            if clarification_count >= 3:
                # Max retries hit. Expire the AI order loop and escalate.
                notes_data["escalated"] = True
                await supabase_service.update_order_status(
                    repeat_order.order_id, 
                    repeat_order.order_status,        
                    order_notes=_json.dumps(notes_data),
                    requires_human_review=True  
                )
                msg = (
                    "Maaf, saya tak pasti kuantiti yang tepat. Saya akan minta ejen manusia untuk hubungi anda sebentar lagi ya! 🙏" if lang == "ms"
                    else "Sorry, I'm not sure about the exact quantity. I'll transfer you to a human agent to help you out! 🙏"
                )
                await supabase_service.log_message(
                    customer_id=customer.customer_id,
                    order_id=repeat_order.order_id,
                    sender_type="agent",
                    message_type="text",
                    content=msg,
                )
                emit("🚨 [Orchestrator] Vague quantity limit reached — Escalating to human agent.")
                return msg

            # Ask for clarification again
            notes_data["clarification_count"] = clarification_count
            await supabase_service.update_order_status(
                repeat_order.order_id,
                OrderStatus.PENDING,
                order_notes=_json.dumps(notes_data)
            )
            msg = (
                "Boleh nyatakan nombor/kuantiti yang tepat? Contohnya: 'tambah 2' atau 'jadikan 5'. 😊" if lang == "ms"
                else "Could you specify the exact number? For example: 'add 2' or 'make it 5'. 😊"
            )
            await supabase_service.log_message(
                customer_id=customer.customer_id,
                order_id=repeat_order.order_id,
                sender_type="agent",
                message_type="text",
                content=msg,
            )
            return msg
            
        # If success, extract the items array
        merged_items = merge_result.get("items",[])

    if not merged_items:
        if lang == "ms":
            msg = "Maaf, saya tidak faham perubahan yang anda mahu. Boleh nyatakan semula? 😊"
        else:
            msg = "Sorry, I couldn't understand your changes. Could you try again? 😊"
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            order_id=repeat_order.order_id,
            sender_type="agent",
            message_type="text",
            content=msg,
        )
        return msg

    # Build IntakeResult from merged items and run inventory agent
    from app.models.schemas import IntakeResult, OrderLineItem
    intake = IntakeResult(
        intent="order",
        items=[
            OrderLineItem(product_name=it["product_name"], quantity=it["quantity"], unit=it.get("unit"))
            for it in merged_items
        ],
        language_detected=lang,
        confidence=0.85,
    )

    # Notify customer we're checking stock
    ack_stock_msg = _ack_checking_stock(lang, intake.items)
    await _send_intermediate(customer, ack_stock_msg)

    emit(f"📦 [InventoryAgent] Checking stock for {len(intake.items)} item(s) (repeat order)...")
    inventory = await run_inventory_agent(intake, merchant_id, lang)

    if not inventory.order_feasible or not inventory.items:
        fallback = inventory.quote_message or (
            "Maaf, kami tidak dapat memproses pesanan ini sekarang. / "
            "Sorry, we couldn't process this order right now."
        )
        await supabase_service.update_order_status(repeat_order.order_id, OrderStatus.EXPIRED)
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            sender_type="agent",
            message_type="text",
            content=fallback,
        )
        return fallback

    # Handle substitution if needed
    sub_items = [i for i in inventory.items if i.is_substituted]
    if sub_items:
        await supabase_service.update_order_status(
            repeat_order.order_id,
            OrderStatus.AWAITING_SUBSTITUTION,
            order_notes=_json.dumps({
                "inventory_result": inventory.model_dump(),
                "intake_result": intake.model_dump(),
                "delivery_address": customer.delivery_address or "",
                "language": lang,
            }),
        )
        question = _build_substitution_question(lang, sub_items)
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            order_id=repeat_order.order_id,
            sender_type="agent",
            message_type="text",
            content=question,
        )
        return question

    # No substitutions — update order and generate quote
    await supabase_service.update_order_status(
        repeat_order.order_id,
        OrderStatus.AWAITING_CONFIRMATION,
        order_notes=_json.dumps({
            "inventory_result": inventory.model_dump(),
            "intake_result": intake.model_dump(),
            "delivery_address": customer.delivery_address or "",
            "language": lang,
        }),
        order_amount=inventory.grand_total,
        confidence_score=intake.confidence,
    )

    await supabase_service.create_order_items(
        repeat_order.order_id,
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

    quote_msg = _build_quote_message(lang, inventory)
    await supabase_service.log_message(
        customer_id=customer.customer_id,
        order_id=repeat_order.order_id,
        sender_type="agent",
        message_type="text",
        content=quote_msg,
    )
    emit(f"✅ [DB] Repeat order {repeat_order.order_id[:8]}... saved — status: Awaiting Confirmation")
    return quote_msg


async def _merge_repeat_modifications(
    raw_text: str,
    previous_items: list[dict],
) -> dict:
    """Use LLM to merge buyer's modifications with previous order items.

    Returns a list of dicts with product_name and quantity.
    """
    import json as _json
    from app.services.glm_client import run_agent_loop
    settings = get_settings()

    prev_summary = "\n".join(
        f"- {it['product_name']}: {it['quantity']} unit" for it in previous_items
    )
    
    system = (
        "You are an order modification assistant. The buyer previously ordered:\n"
        f"{prev_summary}\n\n"
        "Now they want to modify their order. Parse their message and output the FULL updated item list.\n\n"
        "RULES:\n"
        "1. EXACT NUMBERS: If the buyer specifies an exact number (e.g. 'tambah 2', 'add 1', 'jadikan 5'), "
        "calculate the new quantities and return:\n"
        '{"status": "success", "items":[{"product_name": "...", "quantity": ...}]}\n\n'
        "2. AMBIGUOUS: If they are vague and DO NOT specify a number (e.g. 'tambah sikit', 'more', 'less', 'tambah sikit je'), "
        "DO NOT guess the quantity. Immediately return:\n"
        '{"status": "ambiguous", "items":[]}\n\n'
        "Output ONLY the JSON object. Do not include any other text."
    )

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": raw_text},
    ]

    try:
        import re as _re
        raw_output = await run_agent_loop(
            model=settings.model_reasoning,
            messages=messages,
            tools=[],
            tool_executors={},
        )
        raw_output = raw_output.strip()
        fence_match = _re.search(r"```(?:json)?\s*([\s\S]*?)```", raw_output)
        if fence_match:
            raw_output = fence_match.group(1).strip()
        
        if raw_output.startswith("```"):
            raw_output = raw_output.strip("`").strip()
            if raw_output.startswith("json"):
                raw_output = raw_output[4:].strip()
        result = _json.loads(raw_output)
        if isinstance(result, list):
            return {"status": "success", "items": result}
            
        return result
    except Exception as exc:
        logger.error("Merge repeat modifications error: %s", exc)
        return {"status": "error", "items":[]}

# ─────────────────────────────────────────
# Core orchestration handlers
# ─────────────────────────────────────────

async def _handle_new_order(
    raw_text: str,
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

    # Non-order intents
    if intake.intent != "order":
        if intake.clarification_needed and intake.clarification_message:
            # API error / parse failure — use the clarification message directly
            msg = intake.clarification_message
        elif intake.intent == "inquiry":
            # Customer asking a question — answer from live context
            emit("💬 [Orchestrator] Inquiry intent detected — routing to inquiry handler")
            lang = _detect_language(raw_text)
            msg = await _handle_inquiry(raw_text, merchant_id, lang)
        else:
            # complaint / other — generic fallback
            lang = _detect_language(raw_text)
            if lang == "ms":
                msg = "Helo! Saya boleh bantu terima pesanan borong. Hantar mesej atau nota suara dengan butiran pesanan anda ya 😊"
            else:
                msg = "Hi! I can help you place wholesale orders. Just send me a message or voice note with what you need and how much 😊"
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            sender_type="agent",
            message_type="text",
            content=msg,
        )
        return msg

    # Buyer references a previous order — fetch last order and ask for confirmation
    if intake.references_previous_order:
        lang = _detect_language(raw_text)
        msg = await _handle_previous_order_reference(raw_text, customer, merchant_id, lang)
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

    # Use our own language detection on the raw text — the intake agent's
    # language_detected is unreliable for short Malay messages
    lang = _detect_language(raw_text)

    # For text messages: if no delivery address (or too vague), ask for it before proceeding
    import json as _json_addr
    import re as _re_addr

    def _is_specific_address(addr: str) -> bool:
        """Return True only if the address looks specific enough for delivery."""
        if not addr or len(addr.strip()) < 5:
            return False
        a = addr.strip().lower()
        # Must contain a street indicator OR a building number
        has_street = bool(_re_addr.search(
            r"\b(jalan|jln|lorong|lrg|street|st|road|rd|avenue|ave|blok|block|"
            r"no\s*\d|no\.|unit|apt|apartment|taman|tmn|bangunan|plaza|tower)\b", a
        ))
        has_number = bool(_re_addr.search(r"\b\d+\b", a))
        return has_street or has_number

    raw_addr = intake.delivery_address or ""
    has_address = _is_specific_address(raw_addr)
    customer_has_address = _is_specific_address(customer.delivery_address or "")
    if not has_address and not customer_has_address:
        if lang == "ms":
            addr_msg = (
                "Terima kasih! Boleh berikan alamat penghantaran penuh anda? 📍\n"
                "Contoh: No 12, Jalan Ampang, Kuala Lumpur"
            )
        else:
            addr_msg = (
                "Thanks! Could you share your full delivery address? 📍\n"
                "Example: No 12, Jalan Ampang, Kuala Lumpur"
            )
        await supabase_service.create_order(
            customer_id=customer.customer_id,
            merchant_id=merchant_id,
            order_amount=0,
            order_notes=_json_addr.dumps({
                "awaiting_address": True,
                "intake_result": intake.model_dump(),
                "language": lang,
            }),
            confidence_score=intake.confidence,
            requires_human_review=False,
            status=OrderStatus.PENDING,
        )
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            sender_type="agent",
            message_type="text",
            content=addr_msg,
        )
        emit("📍 [Orchestrator] No address found — asked buyer for delivery address")
        return addr_msg

    # Step 2: Notify customer we're checking stock
    ack_stock_msg = _ack_checking_stock(lang, intake.items)
    await _send_intermediate(customer, ack_stock_msg)
    emit(f"📱 [WhatsApp] Sent: \"{ack_stock_msg.split(chr(10))[0]}\"")

    # Step 3: Inventory Agent
    emit(f"📦 [InventoryAgent] Checking stock for {len(intake.items)} item(s)...")
    inventory = await run_inventory_agent(intake, merchant_id, intake.language_detected)
    emit(
        f"📦 [InventoryAgent] Stock check complete — "
        f"{'order feasible ✓' if inventory.order_feasible else 'order unfeasible ✗'} | "
        f"Total: RM{inventory.grand_total:.2f}"
    )

    import json

    if not inventory.order_feasible or not inventory.items:
        # All items out of stock — offer restock notification
        item_names = ", ".join(f"*{i.product_name}*" for i in (inventory.items or intake.items)) or "the item(s)"
        if lang == "ms":
            fallback = (
                f"Maaf, {item_names} sudah habis stok buat masa ini 😔\n\n"
                "Kami boleh menghantar mesej kepada anda apabila stok tiba semula.\n"
                "Balas *YA* jika anda ingin menerima notifikasi, atau *TIDAK* untuk batal."
            )
        else:
            fallback = (
                f"Sorry, {item_names} is currently out of stock 😔\n\n"
                "We can send you a message once it is restocked.\n"
                "Reply *YES* if you would like to receive a notification, or *NO* to skip."
            )
        # Save pending order so YES/NO reply is intercepted
        await supabase_service.create_order(
            customer_id=customer.customer_id,
            merchant_id=merchant_id,
            order_amount=0,
            order_notes=json.dumps({"restock_notification": True, "language": lang, "items": item_names}),
            confidence_score=0.8,
            requires_human_review=False,
            status=OrderStatus.PENDING,
        )
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            sender_type="agent",
            message_type="text",
            content=fallback,
        )
        return fallback

    # Items with zero fulfillment and not substituted — out of stock with no substitute
    no_sub_items = [
        i for i in inventory.items
        if i.fulfilled_qty == 0 and not i.is_substituted
    ]
    if no_sub_items:
        names = ", ".join(f"*{i.product_name}*" for i in no_sub_items)
        # Remove these items — we can't fulfill them at all
        inventory.items = [i for i in inventory.items if not (i.fulfilled_qty == 0 and not i.is_substituted)]
        if lang == "ms":
            restock_msg = (
                f"Kami tidak mempunyai pengganti yang sesuai untuk {names} buat masa ini.\n\n"
                "Maaf atas kesulitan ini 😔 Kami boleh menghantar mesej kepada anda apabila stok tiba semula.\n"
                "Balas *YA* jika anda ingin menerima notifikasi, atau *TIDAK* untuk batal."
            )
        else:
            restock_msg = (
                f"We don't have a suitable substitute for {names} right now.\n\n"
                "Sorry for the inconvenience 😔 We can send you a message once it is restocked.\n"
                "Reply *YES* if you would like to receive a notification, or *NO* to skip."
            )
        # Save a Pending order so YES/NO reply is intercepted
        await supabase_service.create_order(
            customer_id=customer.customer_id,
            merchant_id=merchant_id,
            order_amount=0,
            order_notes=json.dumps({"restock_notification": True, "language": lang, "items": names}),
            confidence_score=0.8,
            requires_human_review=False,
            status=OrderStatus.PENDING,
        )

        if not inventory.items:
            # All items unavailable — just send restock message
            await supabase_service.log_message(
                customer_id=customer.customer_id,
                sender_type="agent",
                message_type="text",
                content=restock_msg,
            )
            return restock_msg
        # Some items still available — send restock note then continue with the rest
        await _send_intermediate(customer, restock_msg)

    # Substitution needed — ask buyer BEFORE generating the full quote
    sub_items = [i for i in inventory.items if i.is_substituted]
    if sub_items:
        emit(f"🔄 [Orchestrator] {len(sub_items)} substitution(s) needed — asking buyer first")
        order = await supabase_service.create_order(
            customer_id=customer.customer_id,
            merchant_id=merchant_id,
            order_amount=inventory.grand_total,
            order_notes="",
            confidence_score=intake.confidence,
            requires_human_review=False,
            status=OrderStatus.AWAITING_SUBSTITUTION,
        )
        await supabase_service.update_order_status(
            order.order_id,
            OrderStatus.AWAITING_SUBSTITUTION,
            order_notes=json.dumps({
                "inventory_result": inventory.model_dump(),
                "intake_result": intake.model_dump(),
                "delivery_address": intake.delivery_address or customer.delivery_address or "",
                "language": intake.language_detected,
            }),
        )
        question = _build_substitution_question(lang, sub_items)
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            order_id=order.order_id,
            sender_type="agent",
            message_type="text",
            content=question,
        )
        return question

    # No substitutions — persist order in Awaiting Confirmation state directly
    emit("💾 [DB] Saving order to database...")
    order = await supabase_service.create_order(
        customer_id=customer.customer_id,
        merchant_id=merchant_id,
        order_amount=inventory.grand_total,
        order_notes="",
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

    quote_msg = _build_quote_message(lang, inventory)

    await supabase_service.log_message(
        customer_id=customer.customer_id,
        order_id=order.order_id,
        sender_type="agent",
        message_type="text",
        content=quote_msg,
    )

    emit(f"✅ [DB] Order {order.order_id[:8]}... saved — status: Awaiting Confirmation")
    emit("📝 [Composer] Generating order quote message for buyer...")
    logger.info("Order %s created, awaiting buyer confirmation", order.order_id)
    return quote_msg


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
    emit_message(ack)
    emit("🚚 [Logistics] Arranging delivery...")

    _collector = _msg_collector.get()
    if _collector is not None:
        # Add ack to collector FIRST so the frontend shows it before the tracking message
        _collector.append(ack)
        # Inline: mock-chat — run logistics now so result is in the response
        logistics = await run_logistics_agent(pending_order, inv_result, delivery_address, language)
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            order_id=pending_order.order_id,
            sender_type="agent",
            message_type="text",
            content=logistics.confirmation_message,
        )
        await twilio_service.send_whatsapp_message(customer.whatsapp_number, logistics.confirmation_message)
        emit_message(logistics.confirmation_message)
        _collector.append(logistics.confirmation_message)
    else:
        # Background: real Twilio path
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
            emit_message(logistics.confirmation_message)

        _inventory_queue.put_nowait(_do_logistics())
        ensure_inventory_worker()

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
    media_content: Optional[str] = None,
    media_content_type: str = "image/jpeg",
) -> str:
    ensure_inventory_worker()

    # 1. Get or create customer
    emit(f"👤 [CRM] Looking up customer: {from_number}...")
    customer = await supabase_service.get_or_create_customer(from_number, merchant_id)
    emit(f"👤 [CRM] Customer found — ID ...{customer.customer_id[-8:]}")
    
    # This is the "Rest Async State" - it prevents AI from even parsing the message
    pending_orders = await supabase_service.get_orders_with_details(merchant_id, limit=10)
    # Find if THIS specific customer has an active order flagged for review
    review_order = next((o for o in pending_orders 
                        if o['customer_id'] == customer.customer_id 
                        and o.get('requires_human_review') == True
                        and o.get('order_status') not in ['Confirmed', 'Failed', 'Expired']), None)
    
    if review_order:
        emit("🔒 [State] Order is locked for Human Review. AI is on standby.")
        lang = _detect_language(text_content or "")
        final = (
            "Sila tunggu sebentar, ejen manusia kami sedang menyemak pesanan anda dan akan membalas tidak lama lagi! 🙏" if lang == "ms"
            else "Please wait a moment, our human agent is reviewing your order and will be with you shortly! 🙏"
        )
        # We log and return immediately to prevent the AI agents from running
        await supabase_service.log_message(customer.customer_id, "agent", "text", final, order_id=review_order['order_id'])
        return final

    # 2. Log inbound message
    await supabase_service.log_message(
        customer_id=customer.customer_id,
        sender_type="buyer",
        message_type=message_type.value,
        content=text_content or "",
        media_url=media_url,
    )

    # 3. Route based on current conversation state
    emit("📋 [State] Checking conversation state...")
    address_order = await supabase_service.get_address_pending_order(customer.customer_id)
    restock_order = await supabase_service.get_restock_pending_order(customer.customer_id)
    repeat_order = await supabase_service.get_repeat_pending_order(customer.customer_id)
    sub_order = await supabase_service.get_substitution_pending_order(customer.customer_id)
    pending_order = await supabase_service.get_pending_order(customer.customer_id)
    
    # If any active order has the human review flag set, stop the AI here.
    review_order = next((o for o in [address_order, restock_order, repeat_order, sub_order, pending_order] 
                        if o and o.requires_human_review), None)

    # Resolve the message text early so we can inspect it for routing decisions
    raw_text = await _resolve_to_text(message_type, text_content, media_url, media_content, media_content_type)
    
    if review_order:
        emit(f"📋 [State] Order {review_order.order_id[:8]} is flagged for review — blocking AI.")
        lang = _detect_language(raw_text)
        final = (
            "Sila tunggu sebentar, ejen manusia kami sedang menyemak pesanan anda dan akan membalas tidak lama lagi! 🙏" if lang == "ms"
            else "Please wait a moment, our human agent is reviewing your order and will be with you shortly! 🙏"
        )
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            order_id=review_order.order_id,
            sender_type="agent",
            message_type="text",
            content=final,
        )
        # We return early here so the AI doesn't try to process the new message
        collector = _msg_collector.get()
        if collector is not None: collector.append(final)
        return final

    # Auto-expire pending orders that are:
    # (a) older than 30 minutes, OR
    # (b) for substitution/confirmation: message is NOT a YES/NO reply (i.e. it's a new order)
    from datetime import datetime, timezone, timedelta
    _stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)

    def _is_stale_dt(order: OrderRow) -> bool:
        try:
            created = datetime.fromisoformat(order.created_at.replace("Z", "+00:00"))
            return created < _stale_cutoff
        except Exception:
            return False

    _is_confirm_reply = _is_confirmation(raw_text) is not None  # True/False = YES/NO, not None

    for _order, _label in [
        (review_order, "review"), (address_order, "address"), (restock_order, "restock"), (repeat_order, "repeat"),
        (sub_order, "substitution"), (pending_order, "confirmation"),
    ]:
        if not _order:
            continue
        _expire = False
        if _label == "review":
            pass
        elif _is_stale_dt(_order):
            emit(f"⏰ [State] Expiring stale {_label} order {_order.order_id[:8]} (>30 min old)")
            _expire = True
        elif _label in ("substitution", "confirmation") and not _is_confirm_reply:
            # Message looks like a new order, not a YES/NO — discard the old state
            emit(f"🔄 [State] New order detected — discarding pending {_label} order {_order.order_id[:8]}")
            _expire = True
        if _expire:
            await supabase_service.update_order_status(_order.order_id, OrderStatus.EXPIRED)
            if _order is address_order: address_order = None
            if _order is restock_order: restock_order = None
            if _order is repeat_order: repeat_order = None
            if _order is sub_order: sub_order = None
            if _order is pending_order: pending_order = None

    if review_order:
        emit(f"📋 [State] Order {review_order.order_id[:8]} is awaiting human review — locking chat.")
        lang = _detect_language(raw_text)
        final = (
            "Sila tunggu sebentar, ejen manusia kami sedang menyemak pesanan anda dan akan membalas tidak lama lagi! 🙏" if lang == "ms"
            else "Please wait a moment, our human agent is reviewing your order and will be with you shortly! 🙏"
        )
        await supabase_service.log_message(
            customer_id=customer.customer_id,
            order_id=review_order.order_id,
            sender_type="agent",
            message_type="text",
            content=final,
        )
    elif address_order:
        emit(f"📋 [State] Awaiting delivery address — order {address_order.order_id[:8]}...")
        final = await _handle_address_reply(raw_text, address_order, customer, merchant_id)
    elif restock_order:
        emit(f"📋 [State] Awaiting restock notification reply — order {restock_order.order_id[:8]}...")
        final = await _handle_restock_reply(raw_text, restock_order, customer)
    elif repeat_order:
        emit(f"📋 [State] Awaiting repeat order clarification — order {repeat_order.order_id[:8]}...")
        final = await _handle_repeat_order_reply(raw_text, repeat_order, customer, merchant_id)
    elif sub_order:
        emit(f"📋 [State] Awaiting substitution reply — order {sub_order.order_id[:8]}...")
        final = await _handle_substitution_reply(raw_text, sub_order, customer)
    elif pending_order:
        emit(f"📋 [State] Awaiting confirmation reply — order {pending_order.order_id[:8]}...")
        final = await _handle_confirmation_reply(raw_text, pending_order, customer)
    else:
        emit("📋 [State] No pending order — treating as new order request")
        lang = _detect_language(text_content or "")
        # Only send ack for audio/image — text ack is already shown by the frontend immediately
        if message_type != MessageType.TEXT:
            await _send_intermediate(customer, _ack_received(message_type, lang))

        if not raw_text.strip():
            final = (
                "Hi! 👋 I'm SupplyLah — send me your order as a text message, voice note, or photo of your order list. "
                "/ Halo! Saya SupplyLah — hantar pesanan anda sebagai mesej, nota suara, atau gambar senarai pesanan."
            )
        else:
            # 5. Process as new order
            final = await _handle_new_order(raw_text, customer, merchant_id)

    # Add the final reply to the mock-chat collector (if active)
    collector = _msg_collector.get()
    if collector is not None and final not in collector:
        collector.append(final)

    return final


# ─────────────────────────────────────────
# Manual Review Resumption
# ─────────────────────────────────────────

async def resume_pipeline_after_manual_review(
    order_id: str,
    notes_json: str,
    lang: str,
    merchant_id: str,
    customer: CustomerRow,
) -> str:
    from app.services.log_stream import emit, emit_message
    try:
        import traceback
        import json as _json
        from app.models.schemas import IntakeResult, OrderLineItem
        
        data = {}
        try:
            data = _json.loads(notes_json)
        except Exception:
            pass
            
        items_data = []
        if "inventory_result" in data and "items" in data["inventory_result"]:
            items_data = data["inventory_result"]["items"]
        elif "previous_items" in data:
            items_data = data["previous_items"]
        elif "intake_result" in data and "items" in data["intake_result"]:
            items_data = data["intake_result"]["items"]
        elif "items" in data:
            items_data = data["items"]
            
        # Rebuild items list for inventory
        order_items = []
        for it in items_data:
            qty = it.get("fulfilled_qty") or it.get("quantity") or 1
            name = it.get("product_name") or "Unknown"
            unit = it.get("unit")
            order_items.append(OrderLineItem(product_name=name, quantity=qty, unit=unit))
            
        intake = IntakeResult(
            intent="order",
            items=order_items,
            language_detected=lang,
            confidence=0.99,
            delivery_address=data.get("delivery_address") or customer.delivery_address or ""
        )
        
        # Notify customer we're checking stock
        ack_stock_msg = _ack_checking_stock(lang, intake.items)
        await _send_intermediate(customer, ack_stock_msg)
        emit(f"📦 [InventoryAgent] Manual Resume - Checking stock for {len(intake.items)} item(s)...")

        # Run Inventory Agent
        inventory = await run_inventory_agent(intake, merchant_id, lang)

        if not inventory.order_feasible or not inventory.items:
            fallback = inventory.quote_message or (
                "Maaf, kami tidak dapat memproses pesanan ini sekarang." if lang == "ms" else
                "Sorry, we couldn't process this order right now."
            )
            await supabase_service.update_order_status(order_id, OrderStatus.EXPIRED)
            await supabase_service.log_message(
                customer_id=customer.customer_id, sender_type="agent", message_type="text", content=fallback,
            )
            emit_message(fallback)
            return fallback

        # Handle substitution if needed
        sub_items = [i for i in inventory.items if i.is_substituted]
        if sub_items:
            await supabase_service.update_order_status(
                order_id,
                OrderStatus.AWAITING_SUBSTITUTION,
                order_notes=_json.dumps({
                    "inventory_result": inventory.model_dump(),
                    "intake_result": intake.model_dump(),
                    "delivery_address": intake.delivery_address,
                    "language": lang,
                }),
            )
            question = _build_substitution_question(lang, sub_items)
            await supabase_service.log_message(
                customer_id=customer.customer_id, order_id=order_id,
                sender_type="agent", message_type="text", content=question,
            )
            emit_message(question)
            return question

        # No substitutions — persist order in Awaiting Confirmation state directly
        await supabase_service.create_order_items(
            order_id,
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

        await supabase_service.update_order_status(
            order_id,
            OrderStatus.AWAITING_CONFIRMATION,
            order_notes=_json.dumps({
                "inventory_result": inventory.model_dump(),
                "intake_result": intake.model_dump(),
                "delivery_address": intake.delivery_address,
                "language": lang,
            }),
            order_amount=inventory.grand_total,
            confidence_score=1.0,
        )

        quote_msg = _build_quote_message(lang, inventory)
        await supabase_service.log_message(
            customer_id=customer.customer_id, order_id=order_id,
            sender_type="agent", message_type="text", content=quote_msg,
        )
        emit_message(quote_msg)
        emit(f"✅ [DB] Order {order_id[:8]}... manual resume complete — Awaiting Confirmation")
        
        return quote_msg

    except Exception as exc:
        import traceback
        err_msg = f"❌ [Error in Resume Pipeline] {str(exc)}\n{traceback.format_exc()}"
        emit(err_msg)
        emit_message(err_msg)
        import logging
        logging.getLogger(__name__).error(err_msg)
        return ""
