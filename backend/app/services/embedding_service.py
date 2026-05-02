"""Local embedding service using paraphrase-multilingual-MiniLM-L12-v2.

Produces 384-dim vectors. Supports Bahasa Melayu, Bahasa Rojak, and English
without any API key — model is downloaded once and cached locally.
"""
from __future__ import annotations

import logging
from functools import lru_cache

logger = logging.getLogger(__name__)

_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"


@lru_cache(maxsize=1)
def _get_model():
    from sentence_transformers import SentenceTransformer
    logger.info("Loading embedding model %s (first call only)...", _MODEL_NAME)
    return SentenceTransformer(_MODEL_NAME)


def embed_text(text: str) -> list[float]:
    """Return a normalised 384-dim embedding for the given text."""
    model = _get_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Return normalised embeddings for a batch of texts (more efficient than looping)."""
    model = _get_model()
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
    return [e.tolist() for e in embeddings]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two normalised vectors (dot product suffices)."""
    return float(sum(x * y for x, y in zip(a, b)))
