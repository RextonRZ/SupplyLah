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

    emit("🤖 [InventoryAgent] Calling AI model to generate quote...")

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

    try:
        raw_output = await run_agent_loop(
            model=settings.model_reasoning,
            messages=messages,
            tools=[],
            tool_executors={},
        )

        raw_output = raw_output.strip()

        # Strip any markdown code fences the model may have added
        import re as _re
        fence_match = _re.search(r"```(?:json)?\s*([\s\S]*?)```", raw_output)
        if fence_match:
            raw_output = fence_match.group(1).strip()
        elif raw_output.startswith("```"):
            raw_output = raw_output.strip("`").strip()
            if raw_output.startswith("json"):
                raw_output = raw_output[4:].strip()

        if not raw_output:
            raise json.JSONDecodeError("Empty response from model", "", 0)

        data = json.loads(raw_output)

        resolved_items = [
            ResolvedOrderItem(
                product_id=i.get("product_id", ""),
                product_name=i["product_name"],
                requested_qty=i.get("requested_qty", 0),
                fulfilled_qty=i.get("fulfilled_qty", 0),
                unit_price=float(i.get("unit_price", 0)),
                line_total=float(i.get("line_total", 0)),
                is_substituted=i.get("is_substituted", False),
                substitute_reason=i.get("substitute_reason"),
            )
            for i in data.get("items", [])
        ]

        return InventoryResult(
            order_feasible=data.get("order_feasible", False),
            items=resolved_items,
            total_amount=float(data.get("total_amount", 0)),
            discount_applied=float(data.get("discount_applied", 0)),
            delivery_fee=float(data.get("delivery_fee", 15.0)),
            grand_total=float(data.get("grand_total", 0)),
            quote_message=data.get("quote_message", ""),
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
