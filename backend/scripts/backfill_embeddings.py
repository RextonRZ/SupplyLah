"""Backfill script — generate and store product embeddings in Supabase.

Fetches all products with a NULL embedding column, encodes them using the
local multilingual model, and writes the 384-dim vectors back to Postgres
via the Supabase client.

Usage (from the backend/ directory):
    python -m scripts.backfill_embeddings

Prerequisites:
    pip install sentence-transformers  (already in requirements.txt)
    SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# Allow running as a module from the backend/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

_BATCH_SIZE = 32
_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"


def _build_product_text(product_name: str, slang_aliases: list[str]) -> str:
    """Canonical text representation used when encoding a product.

    Mirrors the format that will be used for query encoding so that
    cosine similarity scores are meaningful.
    """
    alias_str = ", ".join(slang_aliases) if slang_aliases else ""
    if alias_str:
        return f"Product: {product_name}. Aliases: {alias_str}"
    return f"Product: {product_name}"


def main() -> None:
    from sentence_transformers import SentenceTransformer
    from app.services.supabase_service import get_supabase

    db = get_supabase()

    # Fetch all products with a NULL embedding
    logger.info("Fetching products with NULL embedding...")
    result = (
        db.table("product")
        .select("product_id, product_name, slang_aliases")
        .is_("embedding", "null")
        .execute()
    )
    products = result.data or []

    if not products:
        logger.info("All products already have embeddings — nothing to do.")
        return

    logger.info("Found %d products to embed.", len(products))

    logger.info("Loading model %s (may take a moment on first run)...", _MODEL_NAME)
    model = SentenceTransformer(_MODEL_NAME)

    # Build text representations in the same order as the product list
    texts = [
        _build_product_text(p["product_name"], p.get("slang_aliases") or [])
        for p in products
    ]

    # Encode in batches for efficiency
    logger.info("Encoding %d products in batches of %d...", len(texts), _BATCH_SIZE)
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        batch_size=_BATCH_SIZE,
        show_progress_bar=True,
    ).tolist()

    # Write back to Supabase
    success = 0
    errors = 0
    for product, embedding in zip(products, embeddings):
        try:
            db.table("product").update({"embedding": embedding}).eq(
                "product_id", product["product_id"]
            ).execute()
            success += 1
        except Exception as exc:
            logger.error(
                "Failed to update product %s (%s): %s",
                product["product_id"],
                product["product_name"],
                exc,
            )
            errors += 1

    logger.info(
        "Backfill complete — %d updated, %d errors.", success, errors
    )


if __name__ == "__main__":
    main()
