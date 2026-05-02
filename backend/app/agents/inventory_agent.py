"""Inventory & Logic Agent — GLM-5.1 powered stock checker and quote generator."""
from __future__ import annotations

import asyncio
import json
import logging

from pathlib import Path

from app.config import get_settings
from app.models.schemas import IntakeResult, InventoryResult, ResolvedOrderItem
from app.services import supabase_service
from app.services.glm_client import run_agent_loop
from app.services.log_stream import emit

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "inventory_prompt.md"


def _load_system_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


async def run_inventory_agent(
    intake_result: IntakeResult,
    merchant_id: str,
    customer_language: str = "mixed",
) -> InventoryResult:
    """Evaluate intake result against live inventory and produce a buyer quote.

    Inventory and business rules are fetched in parallel and injected into the
    system prompt, reducing Gemini calls from ~5 to 1 per message.
    """
    settings = get_settings()
    system_prompt = _load_system_prompt()

    # Fetch inventory + rules in parallel; inject into context instead of tool-call round trips
    products, business_rules = await asyncio.gather(
        supabase_service.get_products(merchant_id),
        supabase_service.get_knowledge_base_rules(merchant_id),
    )

    # Per-item stock pre-check against live DB — emitted to SSE before LLM call
    def _match_product(name: str):
        nl = name.lower()
        for p in products:
            if nl in p.product_name.lower() or p.product_name.lower() in nl:
                return p
            if any(nl in a.lower() or a.lower() in nl for a in (p.slang_aliases or [])):
                return p
        return None

    for item in intake_result.items:
        matched = _match_product(item.product_name)
        if matched:
            if matched.stock_quantity >= item.quantity:
                emit(
                    f"✅ [Stock] {matched.product_name}: "
                    f"need {item.quantity}, have {matched.stock_quantity} — sufficient"
                )
            else:
                emit(
                    f"⚠️  [Stock] {matched.product_name}: "
                    f"need {item.quantity}, have {matched.stock_quantity} — LOW STOCK"
                )
        else:
            emit(f"❓ [Stock] {item.product_name}: not found in catalogue — AI will resolve")
        await asyncio.sleep(0)

    emit("🤖 [InventoryAgent] Calling AI model to generate quote...")
    await asyncio.sleep(0)

    inventory_json = json.dumps(
        [
            {
                "product_id": p.product_id,
                "product_name": p.product_name,
                "unit_price": p.unit_price,
                "stock_quantity": p.stock_quantity,
                "slang_aliases": p.slang_aliases,
            }
            for p in products
        ],
        ensure_ascii=False,
    )

    order_summary = json.dumps(
        {
            "items": [
                {"product_name": item.product_name, "quantity": item.quantity, "unit": item.unit}
                for item in intake_result.items
            ],
            "delivery_address": intake_result.delivery_address,
            "language": customer_language,
        },
        ensure_ascii=False,
    )

    messages = [
        {
            "role": "system",
            "content": (
                system_prompt
                + f"\n\nCurrent inventory:\n{inventory_json}"
                + f"\n\nBusiness rules:\n{business_rules}"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Merchant ID: {merchant_id}\n"
                f"Buyer language: {customer_language}\n\n"
                f"Order request:\n{order_summary}"
            ),
        },
    ]

    def _clean_json(text: str) -> str:
        import re as _re
        # Strip markdown fences
        fence = _re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if fence:
            text = fence.group(1).strip()
        elif text.startswith("```"):
            text = text.strip("`").strip()
            if text.startswith("json"):
                text = text[4:].strip()
        # Remove trailing commas before } or ] — common Gemini quirk
        text = _re.sub(r",\s*([}\]])", r"\1", text)
        return text.strip()

    try:
        raw_output = ""
        data = None
        for attempt in range(3):
            raw_output = await run_agent_loop(
                model=settings.model_reasoning,
                messages=messages,
                tools=[],
                tool_executors={},
            )
            raw_output = _clean_json(raw_output.strip())
            if not raw_output:
                logger.warning("Inventory agent got empty response (attempt %d/3), retrying...", attempt + 1)
                emit(f"⚠️ [InventoryAgent] Empty AI response, retrying... ({attempt + 1}/3)")
                await asyncio.sleep(5)
                continue
            try:
                data = json.loads(raw_output)
                break
            except json.JSONDecodeError as parse_err:
                logger.warning("Inventory agent JSON parse error (attempt %d/3): %s", attempt + 1, parse_err)
                emit(f"⚠️ [InventoryAgent] Malformed JSON, retrying... ({attempt + 1}/3)")
                await asyncio.sleep(3)

        if data is None:
            raise json.JSONDecodeError("Failed to get valid JSON after 3 attempts", "", 0)

        resolved_items = [
            ResolvedOrderItem(
                product_id=i.get("product_id", ""),
                product_name=i["product_name"],
                original_product_name=i.get("original_product_name"),
                requested_qty=i.get("requested_qty", 0),
                fulfilled_qty=i.get("fulfilled_qty", 0),
                unit_price=float(i.get("unit_price", 0)),
                line_total=float(i.get("line_total", 0)),
                is_substituted=i.get("is_substituted", False),
                discount_pct=float(i["discount_pct"]) if i.get("discount_pct") is not None else None,
                substitute_reason=i.get("substitute_reason"),
            )
            for i in data.get("items", [])
        ]

        # ── Hard stock validation ─────────────────────────────────────────────
        # The LLM can hallucinate OOS even when stock_quantity > 0. Re-check
        # every item against live DB values and correct fulfilled_qty / feasibility.
        product_map = {p.product_id: p for p in products}
        name_map = {p.product_name.lower(): p for p in products}
        corrected_oos: list[str] = []
        for item in resolved_items:
            live = product_map.get(item.product_id) or name_map.get(item.product_name.lower())
            if live is None:
                continue
            if item.fulfilled_qty == 0 and not item.is_substituted and live.stock_quantity > 0:
                # LLM wrongly said OOS — correct it
                correctable_qty = min(item.requested_qty, live.stock_quantity)
                emit(
                    f"🔧 [Inventory] Correcting LLM error: '{item.product_name}' has "
                    f"{live.stock_quantity} in stock but LLM said 0 — setting fulfilled_qty={correctable_qty}"
                )
                item.fulfilled_qty = correctable_qty
                item.line_total = round(correctable_qty * item.unit_price, 2)
            elif item.fulfilled_qty > 0 and live.stock_quantity == 0:
                # LLM said in-stock but DB says 0 — correct it
                emit(
                    f"🔧 [Inventory] Correcting LLM error: '{item.product_name}' has 0 stock "
                    f"but LLM said fulfilled_qty={item.fulfilled_qty} — setting to 0"
                )
                item.fulfilled_qty = 0
                item.line_total = 0.0
                corrected_oos.append(item.product_name)
            elif item.fulfilled_qty > live.stock_quantity:
                # LLM over-fulfilled — cap at actual stock
                emit(
                    f"🔧 [Inventory] Capping '{item.product_name}': "
                    f"LLM fulfilled {item.fulfilled_qty} but only {live.stock_quantity} available"
                )
                item.fulfilled_qty = live.stock_quantity
                item.line_total = round(live.stock_quantity * item.unit_price, 2)

        # Recompute totals after corrections
        total_amount = round(sum(i.line_total for i in resolved_items), 2)
        delivery_fee = float(data.get("delivery_fee", 15.0))
        discount_applied = float(data.get("discount_applied", 0))
        grand_total = round(total_amount - discount_applied + delivery_fee, 2)
        any_fulfilled = any(i.fulfilled_qty > 0 for i in resolved_items)

        out_of_stock = list(set(data.get("out_of_stock_items", []) + corrected_oos))
        # Remove items that were corrected back to in-stock from the OOS list
        corrected_back = {i.product_name for i in resolved_items if i.fulfilled_qty > 0}
        out_of_stock = [n for n in out_of_stock if n not in corrected_back]

        return InventoryResult(
            order_feasible=any_fulfilled,
            items=resolved_items,
            total_amount=total_amount,
            discount_applied=discount_applied,
            delivery_fee=delivery_fee,
            grand_total=grand_total,
            quote_message=data.get("quote_message", ""),
            out_of_stock_items=out_of_stock,
            requires_substitution=data.get("requires_substitution", False),
            notes=data.get("notes"),
        )

    except json.JSONDecodeError as exc:
        logger.error("Inventory agent returned unparseable JSON: %s", exc)
        return InventoryResult(
            order_feasible=False,
            items=[],
            total_amount=0,
            grand_total=0,
            quote_message="Sorry, I encountered an error preparing your quote. Please try again.",
            notes=f"JSON parse error: {exc}",
        )
    except Exception as exc:
        logger.error("Inventory agent error: %s", exc, exc_info=True)
        return InventoryResult(
            order_feasible=False,
            items=[],
            total_amount=0,
            grand_total=0,
            quote_message=(
                "Maaf, sistem kami sibuk sekarang 🙏 Sila cuba hantar semula pesanan anda dalam seminit. / "
                "Sorry, our system is busy right now 🙏 Please resend your order in a minute."
            ),
            notes=str(exc),
        )
