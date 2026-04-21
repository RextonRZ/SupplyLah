"""Logistics Agent — GLM-4.7-Flash for delivery booking and confirmation messages."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import get_settings
from app.mcp.tools import LOGISTICS_TOOLS, build_logistics_executors
from app.models.schemas import InventoryResult, LogisticsResult, OrderRow
from app.services.glm_client import run_agent_loop

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "logistics_prompt.md"
_DEFAULT_PICKUP = "SupplyLah Warehouse, No 1, Jalan Industri, Shah Alam, Selangor"


def _load_system_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


async def run_logistics_agent(
    order: OrderRow,
    inventory_result: InventoryResult,
    delivery_address: str,
    customer_language: str = "mixed",
) -> LogisticsResult:
    """Book delivery and generate buyer confirmation message.

    Args:
        order: The confirmed order row from the database.
        inventory_result: Resolved items with pricing from Inventory Agent.
        delivery_address: Buyer's delivery address.
        customer_language: For localising the confirmation message.

    Returns:
        LogisticsResult with tracking URL and WhatsApp confirmation text.
    """
    settings = get_settings()
    system_prompt = _load_system_prompt()

    # Estimate weight: ~0.5kg per unit as a rough proxy
    total_units = sum(i.fulfilled_qty for i in inventory_result.items)
    estimated_weight_kg = max(1.0, total_units * 0.5)

    context = {
        "order_id": order.order_id,
        "items": [
            {
                "product_id": i.product_id,
                "product_name": i.product_name,
                "quantity": i.fulfilled_qty,
            }
            for i in inventory_result.items
        ],
        "delivery_address": delivery_address,
        "pickup_address": _DEFAULT_PICKUP,
        "grand_total": inventory_result.grand_total,
        "weight_kg": estimated_weight_kg,
        "buyer_language": customer_language,
    }

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                f"Order confirmed. Process delivery and generate confirmation.\n\n"
                f"Context:\n{json.dumps(context, ensure_ascii=False)}"
            ),
        },
    ]

    executors = build_logistics_executors(
        merchant_id=order.merchant_id,
        pickup_address=_DEFAULT_PICKUP,
    )

    try:
        raw_output = await run_agent_loop(
            model=settings.model_fast,
            messages=messages,
            tools=LOGISTICS_TOOLS,
            tool_executors=executors,
        )

        raw_output = raw_output.strip()
        if raw_output.startswith("```"):
            raw_output = raw_output.split("```")[1]
            if raw_output.startswith("json"):
                raw_output = raw_output[4:]

        data = json.loads(raw_output)

        return LogisticsResult(
            booking_reference=data.get("booking_reference", "N/A"),
            provider=data.get("provider", "Lalamove"),
            tracking_url=data.get("tracking_url", ""),
            estimated_price=float(data.get("estimated_price", 0)),
            eta_minutes=int(data.get("eta_minutes", 45)),
            confirmation_message=data.get("confirmation_message", "Order confirmed! Delivery arranged."),
        )

    except json.JSONDecodeError as exc:
        logger.error("Logistics agent returned unparseable JSON: %s", exc)
        return LogisticsResult(
            booking_reference="ERR",
            tracking_url="",
            estimated_price=0,
            eta_minutes=0,
            confirmation_message="Your order is confirmed! We are arranging delivery — you will receive tracking info shortly.",
        )
    except Exception as exc:
        logger.error("Logistics agent error: %s", exc, exc_info=True)
        return LogisticsResult(
            booking_reference="ERR",
            tracking_url="",
            estimated_price=0,
            eta_minutes=0,
            confirmation_message="Order confirmed! There was an issue booking delivery — our team will contact you.",
        )
