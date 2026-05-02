"""Intake Agent — GLM-5.1 powered order parser for multilingual WhatsApp messages."""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from app.config import get_settings
from app.models.schemas import IntakeResult, OrderLineItem
from app.services import supabase_service
from app.services import embedding_service
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
    await asyncio.sleep(0)
    products = await supabase_service.get_products(merchant_id)
    emit(f"📦 [IntakeAgent] Catalogue loaded — {len(products)} products, aliases mapped")
    await asyncio.sleep(0)
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

    # Dynamic few-shot: embed the incoming message and retrieve the 3 most
    # semantically similar examples from the Mesolitica-grounded dataset.
    dynamic_examples_block = ""
    try:
        emit("🔍 [IntakeAgent] Retrieving similar few-shot examples via pgvector...")
        await asyncio.sleep(0)
        query_embedding = await embedding_service.embed_text_async(raw_message)
        few_shot_hits = await supabase_service.retrieve_few_shot_examples(query_embedding, match_count=3)
        if few_shot_hits:
            lines = []
            for i, hit in enumerate(few_shot_hits, 1):
                lines.append(
                    f"[Example {i}]\n"
                    f"Message: {hit['raw_message']}\n"
                    f"Parsed: {json.dumps(hit['parsed_output'], ensure_ascii=False)}"
                )
            dynamic_examples_block = (
                "\n\n=== Semantically Similar Order Examples (retrieved from Malaysian dataset) ===\n"
                + "\n\n".join(lines)
            )
            emit(f"✅ [IntakeAgent] Injecting {len(few_shot_hits)} dynamic few-shot examples:")
            await asyncio.sleep(0)
            for i, hit in enumerate(few_shot_hits, 1):
                similarity_pct = round(hit.get("similarity", 0) * 100, 1)
                emit(f"   #{i} ({similarity_pct}% match): \"{hit['raw_message']}\"")
                await asyncio.sleep(0)
    except Exception as exc:
        logger.warning("Few-shot retrieval failed, proceeding without: %s", exc)

    messages = [
        {
            "role": "system",
            "content": system_prompt + dynamic_examples_block + f"\n\nAvailable product catalog:\n{catalog}",
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
        await asyncio.sleep(0)
        raw_output = await run_agent_loop(
            model=settings.model_reasoning,
            messages=messages,
            tools=[],
            tool_executors={},
        )
        emit("✅ [IntakeAgent] AI model responded — parsing output...")
        import re as _re
        raw_output = raw_output.strip()
        fence_match = _re.search(r"```(?:json)?\s*([\s\S]*?)```", raw_output)
        if fence_match:
            raw_output = fence_match.group(1).strip()
        elif raw_output.startswith("```"):
            raw_output = raw_output.strip("`").strip()
            if raw_output.startswith("json"):
                raw_output = raw_output[4:].strip()
        # Remove trailing commas before } or ] — common Gemini quirk
        raw_output = _re.sub(r",\s*([}\]])", r"\1", raw_output)

        if not raw_output:
            raise json.JSONDecodeError("Empty response from model", "", 0)

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
            references_previous_order=data.get("references_previous_order", False),
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
