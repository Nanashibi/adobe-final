import json
import os
import pathlib
from typing import Dict, List, Optional, Tuple

import numpy as np

try:
    import faiss  # type: ignore
    FAISS_AVAILABLE = True
except Exception:  # pragma: no cover
    faiss = None  # type: ignore
    FAISS_AVAILABLE = False

from models import get_embedding_model
from embeddings_cache import encode_texts_with_cache


def _paths() -> Tuple[str, str, str]:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_root = os.path.join(base_dir, '..', 'output')
    cache_dir = os.path.join(base_dir, '..', 'cache')
    os.makedirs(cache_dir, exist_ok=True)
    return output_root, os.path.join(cache_dir, 'library.index'), os.path.join(cache_dir, 'library_meta.json')


def _load_output_json(path: str) -> Optional[Dict]:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def _collect_sections(output_root: str) -> List[Dict]:
    """Gather refined sections from every collection's challenge1b_output.json."""
    sections: List[Dict] = []
    for name in sorted(os.listdir(output_root)):
        col_dir = os.path.join(output_root, name)
        if not os.path.isdir(col_dir):
            continue
        p = os.path.join(col_dir, 'challenge1b_output.json')
        data = _load_output_json(p)
        if not data:
            continue
        # Build mapping from (document,page) to refined_text
        submap: Dict[Tuple[str, int], str] = {}
        for sub in data.get('subsection_analysis', []):
            submap[(sub.get('document',''), int(sub.get('page_number', 1)))] = sub.get('refined_text', '')
        for sec in data.get('extracted_sections', []):
            key = (sec.get('document',''), int(sec.get('page_number', 1)))
            sections.append({
                'collection': name,
                'document': key[0],
                'section_title': sec.get('section_title', ''),
                'page_number': key[1],
                'text': submap.get(key, ''),
            })
    return sections


def build_and_save_library(rebuild: bool = False) -> Tuple[Optional[object], np.ndarray, List[Dict]]:
    output_root, index_path, meta_path = _paths()
    model = get_embedding_model()

    # When not rebuilding, try to load existing
    if not rebuild and os.path.exists(meta_path) and (os.path.exists(index_path) or not FAISS_AVAILABLE):
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)
        if FAISS_AVAILABLE and os.path.exists(index_path):
            index = faiss.read_index(index_path)
            return index, np.zeros((0,1), dtype='float32'), meta
        else:
            # Fallback requires embeddings, rebuild them
            rebuild = True

    # Build fresh
    meta = _collect_sections(output_root)
    texts = [m.get('text','') for m in meta]
    embs = encode_texts_with_cache(model, texts, batch_size=64, normalize=True).astype('float32')

    if FAISS_AVAILABLE and len(texts) > 0:
        dim = int(embs.shape[1])
        index = faiss.IndexFlatIP(dim)
        index.add(embs)
        faiss.write_index(index, index_path)
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        return index, np.zeros((0,1), dtype='float32'), meta

    # NumPy fallback: persist only meta; return embeddings for search
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    return None, embs, meta


def _ensure_library_loaded() -> Tuple[Optional[object], np.ndarray, List[Dict]]:
    output_root, index_path, meta_path = _paths()
    if os.path.exists(meta_path) and (os.path.exists(index_path) or not FAISS_AVAILABLE):
        if FAISS_AVAILABLE and os.path.exists(index_path):
            with open(meta_path, 'r', encoding='utf-8') as f:
                meta = json.load(f)
            return faiss.read_index(index_path), np.zeros((0,1), dtype='float32'), meta
        else:
            # Load embeddings by rebuilding (no faiss)
            return build_and_save_library(rebuild=True)
    # Nothing cached yet: build now
    return build_and_save_library(rebuild=True)


def _score_and_snippet(query_text: str, candidate_text: str) -> Tuple[float, str]:
    # Compute normalized embeddings and cosine quickly
    model = get_embedding_model()
    q = encode_texts_with_cache(model, [query_text], batch_size=1, normalize=True)[0]
    c = encode_texts_with_cache(model, [candidate_text], batch_size=1, normalize=True)[0]
    score = float(np.dot(q, c))
    
    # Enhanced snippet: better sentence selection based on relevance
    import re
    sents = re.split(r'(?<=[.!?])\s+', candidate_text.strip())
    if len(sents) <= 2:
        snippet = ' '.join(sents).strip()[:320]
        return score, snippet
    
    # Score sentences by word overlap with query
    query_words = set(query_text.lower().split())
    query_words = {w for w in query_words if len(w) > 3}  # Filter short words
    
    if not query_words:
        # Fallback to first 2 sentences
        snippet = ' '.join(sents[:2]).strip()[:320]
        return score, snippet
    
    # Score each sentence
    sent_scores = []
    for i, sent in enumerate(sents):
        sent_words = set(sent.lower().split())
        overlap = len(query_words.intersection(sent_words))
        sent_scores.append((overlap, i, sent))
    
    # Sort by relevance, then by position (prefer earlier sentences if tied)
    sent_scores.sort(key=lambda x: (-x[0], x[1]))
    
    # Take top 2 most relevant sentences, but maintain order
    selected_indices = sorted([x[1] for x in sent_scores[:2]])
    selected_sents = [sents[i] for i in selected_indices]
    
    snippet = ' '.join(selected_sents).strip()[:320]
    return score, snippet


def query_library_for_sections(
    sections: List[Dict],
    top_k: int = 3,
    exclude_collection: Optional[str] = None,
) -> List[Dict]:
    index, embs, meta = _ensure_library_loaded()
    model = get_embedding_model()
    results: List[Dict] = []
    texts = [m.get('text','') for m in meta]

    # Prepare matrix for numpy fallback
    if not FAISS_AVAILABLE and len(texts) > 0 and embs.size == 0:
        embs = encode_texts_with_cache(model, texts, batch_size=64, normalize=True)

    for sec in sections:
        q_text = sec.get('text','')
        q_emb = encode_texts_with_cache(model, [q_text], batch_size=1, normalize=True)
        scores: List[Tuple[int,float]]
        if index is not None and FAISS_AVAILABLE and len(texts) > 0:
            D, I = index.search(q_emb, min(top_k + 5, len(texts)))
            scores = list(zip(I[0].tolist(), D[0].tolist()))
        else:
            sims = (embs @ q_emb[0].T)
            top_count = min(top_k + 5, sims.shape[0])
            idxs = np.argpartition(-sims, range(top_count))[:top_count]
            idxs = idxs[np.argsort(-sims[idxs])]
            scores = [(int(i), float(sims[int(i)])) for i in idxs]

        items: List[Dict] = []
        for idx, sim in scores:
            item = meta[idx]
            if exclude_collection and item.get('collection') == exclude_collection:
                continue
            sc, snip = _score_and_snippet(q_text, item.get('text',''))
            items.append({
                'document': item.get('document',''),
                'section_title': item.get('section_title',''),
                'page_number': item.get('page_number', 1),
                'collection': item.get('collection',''),
                'similarity': float(sc),
                'snippet': snip,
            })
            if len(items) >= top_k:
                break

        results.append({
            'source': {
                'document': sec.get('document',''),
                'section_title': sec.get('section_title',''),
                'page_number': sec.get('page_number', 1),
            },
            'recommendations': items,
        })
    return results


def generate_library_recommendations_for_output(output_json_path: str, top_k: int = 3) -> Dict:
    with open(output_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    sections = []
    # Map (document,page) to refined text
    submap: Dict[Tuple[str,int], str] = {}
    for sub in data.get('subsection_analysis', []):
        submap[(sub.get('document',''), int(sub.get('page_number', 1)))] = sub.get('refined_text','')
    for sec in data.get('extracted_sections', []):
        key = (sec.get('document',''), int(sec.get('page_number',1)))
        sections.append({
            'document': key[0],
            'section_title': sec.get('section_title',''),
            'page_number': key[1],
            'text': submap.get(key, ''),
        })

    # Exclude current collection from results
    curr_collection = pathlib.Path(output_json_path).parent.name
    groups = query_library_for_sections(sections, top_k=top_k, exclude_collection=curr_collection)
    return { 'metadata': data.get('metadata', {}), 'recommendations': groups }


