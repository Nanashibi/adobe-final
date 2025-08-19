import os
from functools import lru_cache
from typing import Optional

from sentence_transformers import SentenceTransformer
try:
    from sentence_transformers import CrossEncoder  # Optional; not required at runtime
except Exception:  # pragma: no cover - optional import
    CrossEncoder = None  # type: ignore


# Strong default with good speed/quality. Can be overridden via EMBEDDING_MODEL_NAME
DEFAULT_EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-base-en-v1.5")
DEFAULT_RERANKER_MODEL = os.getenv("RERANKER_MODEL_NAME", "cross-encoder/ms-marco-MiniLM-L-6-v2")


@lru_cache(maxsize=1)
def get_embedding_model(model_name: Optional[str] = None) -> SentenceTransformer:
    """
    Returns a singleton SentenceTransformer embedding model.
    Select via EMBEDDING_MODEL_NAME env var. Fallback to bge-base for stronger accuracy than MiniLM.
    """
    name = model_name or DEFAULT_EMBEDDING_MODEL
    # CPU device by default; let SentenceTransformer decide
    try:
        model = SentenceTransformer(name, device=os.getenv("EMBEDDING_DEVICE", "cpu"))
        return model
    except Exception:
        # Safe fallback widely available
        fallback = "sentence-transformers/all-MiniLM-L6-v2"
        return SentenceTransformer(fallback, device=os.getenv("EMBEDDING_DEVICE", "cpu"))


@lru_cache(maxsize=1)
def get_reranker_model(model_name: Optional[str] = None):  # -> Optional[CrossEncoder]
    """
    Returns a singleton CrossEncoder reranker if available; otherwise None.
    Controlled by RERANKER_MODEL_NAME env var. Safe to use conditionally.
    """
    if CrossEncoder is None:
        return None
    name = model_name or DEFAULT_RERANKER_MODEL
    try:
        return CrossEncoder(name, device=os.getenv("RERANKER_DEVICE", "cpu"))
    except Exception:
        # If model can't be loaded (e.g., no weights), disable reranking gracefully
        return None


