import hashlib
import os
import sqlite3
from typing import Iterable, List, Tuple, Optional

import numpy as np
from sentence_transformers import SentenceTransformer


def _default_cache_path() -> str:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    cache_dir = os.path.join(base_dir, '..', 'cache')
    os.makedirs(cache_dir, exist_ok=True)
    return os.path.join(cache_dir, 'embeddings.sqlite3')


def _sha1(text: str) -> str:
    return hashlib.sha1(text.encode('utf-8')).hexdigest()


def _ensure_schema(conn: sqlite3.Connection):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS embeddings (
            model TEXT NOT NULL,
            sha   TEXT NOT NULL,
            dim   INTEGER NOT NULL,
            vec   BLOB NOT NULL,
            PRIMARY KEY (model, sha)
        )
        """
    )


def _open_db(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    _ensure_schema(conn)
    return conn


def encode_texts_with_cache(
    model: SentenceTransformer,
    texts: List[str],
    *,
    cache_path: Optional[str] = None,
    batch_size: int = 32,
    normalize: bool = True,
) -> np.ndarray:
    """
    Encode a list of texts using SentenceTransformer with a persistent sqlite cache.
    Returns normalized float32 embeddings with shape (len(texts), dim).
    """
    if not texts:
        return np.zeros((0, 1), dtype='float32')

    db_path = cache_path or _default_cache_path()
    conn = _open_db(db_path)
    cur = conn.cursor()

    model_name = getattr(model, 'model_card_data', None)
    model_id = os.getenv('EMBEDDING_MODEL_NAME') or getattr(model, 'model_name_or_path', 'default')

    hashes = [_sha1(t) for t in texts]
    cached_rows = {}
    if hashes:
        q_marks = ','.join(['?'] * len(hashes))
        for row in cur.execute(
            f"SELECT sha, dim, vec FROM embeddings WHERE model = ? AND sha IN ({q_marks})",
            (model_id, *hashes),
        ):
            cached_rows[row[0]] = (int(row[1]), row[2])

    to_encode_idx: List[int] = [i for i, h in enumerate(hashes) if h not in cached_rows]

    # Prepare output array lazily once we know dim
    embs: List[np.ndarray] = [None] * len(texts)  # type: ignore
    dim: int | None = None

    # Fill from cache
    for i, h in enumerate(hashes):
        if h in cached_rows:
            d, blob = cached_rows[h]
            vec = np.frombuffer(blob, dtype='float32').reshape(d)
            embs[i] = vec
            dim = dim or d

    # Encode missing in batches
    if to_encode_idx:
        to_encode_texts = [texts[i] for i in to_encode_idx]
        new_embs = model.encode(
            to_encode_texts,
            convert_to_numpy=True,
            normalize_embeddings=normalize,
            batch_size=batch_size,
        ).astype('float32')
        if new_embs.ndim == 1:
            new_embs = new_embs.reshape(1, -1)
        dim = dim or int(new_embs.shape[1])
        # Insert into cache and place into output list
        for j, i in enumerate(to_encode_idx):
            vec = new_embs[j]
            embs[i] = vec
            cur.execute(
                "INSERT OR REPLACE INTO embeddings(model, sha, dim, vec) VALUES (?,?,?,?)",
                (model_id, hashes[i], int(dim), vec.tobytes()),
            )
        conn.commit()

    # Stack into array
    out = np.vstack(embs)  # type: ignore
    return out


