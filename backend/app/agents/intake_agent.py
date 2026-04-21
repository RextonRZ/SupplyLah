"""Intake Agent — GLM-5.1 powered order parser for multilingual WhatsApp messages."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import get_settings
from app.mcp.tools import INTAKE_TOOLS, build_intake_executors
from app.models.schemas import IntakeResult, OrderLineItem
from app.services.glm_client import run_agent_loop

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "intake_prompt.md"


def _load_system_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


async def run_intake_agent(
    raw_message: str,
    merchant_id: str,
) -> IntakeResult:
    """Parse an unstructured buyer message into a structured IntakeResult.

    Args:
        raw_message: The buyer's message (text, or text transcribed from audio/image).
        merchant_id: The merchant's UUID for catalog lookups.

    Returns:
        IntakeResult with extracted order items and confidence score.
    """
    settings = get_settings()
    system_prompt = _load_system_prompt()

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                f"Merchant ID: {merchant_id}\n\n"
                f"Buyer message:\n{raw_message}"
            ),
        },
    ]

    executors = build_intake_executors(merchant_id)

    try:
        raw_output = await run_agent_loop(
            model=settings.model_reasoning,
            messages=messages,
            tools=INTAKE_TOOLS,
            tool_executors=executors,
        )
        # Strip markdown fences if the model adds them
        raw_output = raw_output.strip()
        if raw_output.startswith("```"):
            raw_output = raw_output.split("```")[1]
            if raw_output.startswith("json"):
                raw_output = raw_output[4:]

        data = json.loads(raw_output)

        items = [
            OrderLineItem(
                product_name=i["product_name"],
                quantity=i.get("quantity", 0),
                unit=i.get("unit"),
            )
            for i in data.get("items", [])
        ]

        return IntakeResult(
            intent=data.get("intent", "other"),
            items=items,
            delivery_address=data.get("delivery_address"),
            language_detected=data.get("language_detected", "mixed"),
            confidence=float(data.get("confidence", 0.5)),
            clarification_needed=data.get("clarification_needed", False),
            clarification_message=data.get("clarification_message"),
            notes=data.get("notes"),
        )

    except json.JSONDecodeError as exc:
        logger.error("Intake agent returned unparseable JSON: %s", exc)
        return IntakeResult(
            intent="other",
            items=[],
            confidence=0.0,
            clarification_needed=True,
            clarification_message="Sorry, could you please resend your order? I had trouble reading it. / Maaf, boleh hantar semula pesanan anda?",
        )
    except Exception as exc:
        logger.error("Intake agent error: %s", exc, exc_info=True)
        return IntakeResult(
            intent="other",
            items=[],
            confidence=0.0,
            clarification_needed=True,
            clarification_message="System error — please try again shortly.",
        )
