"""Intake Agent — GLM-5.1 powered order parser for multilingual WhatsApp messages."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import get_settings
from app.models.schemas import IntakeResult, OrderLineItem
from app.services import supabase_service
from app.services.glm_client import run_agent_loop
from app.services.log_stream import emit

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "intake_prompt.md"


def _load_system_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


async def run_intake_agent(
    raw_message: str,
    merchant_id: str,
) -> IntakeResult:
    """Parse an unstructured buyer message into a structured IntakeResult.

    Product catalog is fetched once and injected into the system prompt,
    reducing Gemini calls from ~3 to 1 per message (no tool-call round trips).
    """
    settings = get_settings()
    system_prompt = _load_system_prompt()

    # Fetch catalog once; inject into context instead of tool-call round trips
    emit("📦 [IntakeAgent] Loading product catalogue from database...")
    products = await supabase_service.get_products(merchant_id)
    emit(f"📦 [IntakeAgent] Catalogue loaded — {len(products)} products, aliases mapped")
    catalog = json.dumps(
        [
            {
                "product_name": p.product_name,
                "product_id": p.product_id,
                "slang_aliases": p.slang_aliases,
            }
            for p in products
        ],
        ensure_ascii=False,
    )

    messages = [
        {
            "role": "system",
            "content": system_prompt + f"\n\nAvailable product catalog:\n{catalog}",
        },
        {
            "role": "user",
            "content": (
                f"Merchant ID: {merchant_id}\n\n"
                f"Buyer message:\n{raw_message}"
            ),
        },
    ]

    try:
        emit(f"🤖 [IntakeAgent] Calling AI model ({settings.model_reasoning})...")
        raw_output = await run_agent_loop(
            model=settings.model_reasoning,
            messages=messages,
            tools=[],
            tool_executors={},
        )
        emit("✅ [IntakeAgent] AI model responded — parsing output...")
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
            clarification_message=(
                "Maaf, sistem AI kami tengah sibuk sekarang 🙏 Cuba hantar semula pesanan anda dalam seminit ya! "
                "/ Sorry, our AI is busy right now — please resend your order in a minute! 🙏"
            ),
        )
