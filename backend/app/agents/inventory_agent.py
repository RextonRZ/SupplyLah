"""Inventory & Logic Agent — GLM-5.1 powered stock checker and quote generator."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import get_settings
from app.mcp.tools import INVENTORY_TOOLS, build_inventory_executors
from app.models.schemas import IntakeResult, InventoryResult, ResolvedOrderItem
from app.services.glm_client import run_agent_loop

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

    Args:
        intake_result: Structured output from the Intake Agent.
        merchant_id: Merchant UUID for inventory lookups.
        customer_language: Detected language for localising the quote message.

    Returns:
        InventoryResult with per-item resolution, pricing, and WhatsApp quote message.
    """
    settings = get_settings()
    system_prompt = _load_system_prompt()

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
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                f"Merchant ID: {merchant_id}\n"
                f"Buyer language: {customer_language}\n\n"
                f"Order request:\n{order_summary}"
            ),
        },
    ]

    executors = build_inventory_executors(merchant_id)

    try:
        raw_output = await run_agent_loop(
            model=settings.model_reasoning,
            messages=messages,
            tools=INVENTORY_TOOLS,
            tool_executors=executors,
        )

        raw_output = raw_output.strip()
        if raw_output.startswith("```"):
            raw_output = raw_output.split("```")[1]
            if raw_output.startswith("json"):
                raw_output = raw_output[4:]

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
            quote_message="System error while checking inventory. Our team has been notified.",
            notes=str(exc),
        )
