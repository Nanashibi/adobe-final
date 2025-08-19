# ranker.py
# Functions for semantic similarity ranking
from sentence_transformers import SentenceTransformer, util
from rank_bm25 import BM25Okapi
import re
from typing import List, Dict, Tuple
import math
from models import get_embedding_model, get_reranker_model
from embeddings_cache import encode_texts_with_cache

# Use a stronger default model; override via EMBEDDING_MODEL_NAME env
model: SentenceTransformer = get_embedding_model()
ranks_cross = get_reranker_model()

LEVEL_SCORE = {'H1': 1.0, 'H2': 0.7, 'H3': 0.5}

def is_clean_title(title):
    """Check if section title is meaningful and clean"""
    title = title.strip()
    if not title or len(title) < 5:
        return False
    if title.lower() in ["page", "page 1", "table of contents", "contents", "index", "click here", "introduction"]:
        return False
    if title.startswith(("•", "-", "*", "(", "[", "#")):
        return False
    if title[:3].isdigit() and title[3] in ".- ":
        return False
    if re.match(r"^[A-Za-z]$", title):
        return False
    if sum(c.isalpha() for c in title) < 3:
        return False
    if re.match(r"^[\d\W_]+$", title):
        return False
    return True

def is_actionable_section(section: Dict) -> bool:
    """Check if section contains actionable content (lists, steps, instructions)"""
    text = section.get('text', '').lower()
    # Heuristic: contains bullets, numbers, or action-oriented keywords
    if any(b in text for b in ['•', '-', '*', '1.', '2.', '3.', 'step', 'instruction', 'guide', 'how to']):
        return True
    if any(k in text for k in ['tips', 'activities', 'recommendations', 'things to do', 'guide', 'checklist', 'process']):
        return True
    return False


def normalize_text(text: str) -> str:
    """Basic normalization for more stable lexical scoring.
    - Lowercase
    - Collapse whitespace
    - De-hyphenate line-wrapped words
    - Strip bullets and repeated punctuation
    """
    if not text:
        return ""
    t = text
    # De-hyphenate line wraps like "co-
    # ntext" => "context"
    t = re.sub(r"(\w)-\n(\w)", r"\1\2", t)
    # Remove soft line breaks
    t = t.replace("\r", " ")
    t = t.replace("\n", " ")
    # Remove bullets and excessive punctuation
    t = re.sub(r"[•·•]+", " ", t)
    t = re.sub(r"[\t]+", " ", t)
    # Collapse whitespace
    t = re.sub(r"\s+", " ", t)
    return t.strip().lower()


def tokenize_words(text: str) -> List[str]:
    """Tokenize to alphanumeric words with length >= 2."""
    if not text:
        return []
    return re.findall(r"[a-z0-9]{2,}", text.lower())


def build_bigrams(terms: List[str]) -> List[Tuple[str, str]]:
    return [(terms[i], terms[i + 1]) for i in range(len(terms) - 1)]


def sentence_split(text: str) -> List[str]:
    if not text:
        return []
    # Simple split on sentence punctuation
    parts = re.split(r"(?<=[\.!?])\s+", text.strip())
    # Filter very short fragments
    return [p.strip() for p in parts if len(p.strip()) > 0]


def select_snippet(original_text: str, query_terms: List[str], max_tokens: int = 150) -> str:
    """Pick the best sentence by term density and include a neighbor. Trim to ~max_tokens."""
    text = normalize_text(original_text)
    sentences = sentence_split(text)
    if not sentences:
        return original_text[:600]

    # Score each sentence by unigram and bigram matches
    q_terms = [t for t in query_terms if len(t) > 2]
    q_bigrams = build_bigrams(q_terms)

    def sent_score(s: str) -> float:
        tokens = tokenize_words(s)
        token_set = set(tokens)
        unigram_hits = sum(1 for t in q_terms if t in token_set)
        bigram_hits = 0
        if len(tokens) > 1 and q_bigrams:
            pairs = set((tokens[i], tokens[i + 1]) for i in range(len(tokens) - 1))
            bigram_hits = sum(1 for b in q_bigrams if b in pairs)
        return unigram_hits + 2.0 * bigram_hits

    best_idx = max(range(len(sentences)), key=lambda i: sent_score(sentences[i]))
    # Compose window ±1 sentence
    start = max(0, best_idx - 1)
    end = min(len(sentences), best_idx + 2)
    snippet = " ".join(sentences[start:end])

    # Trim to approx max_tokens
    tokens = snippet.split()
    if len(tokens) > max_tokens:
        tokens = tokens[:max_tokens]
    return " ".join(tokens)

def _build_queries(persona: str, job: str) -> List[str]:
    persona_terms = [t for t in re.split(r"[,/;\-]\s*|\s+", persona) if len(t) > 2]
    job_terms = [t for t in re.split(r"[,/;\-]\s*|\s+", job) if len(t) > 2]
    joined = " ".join(set(persona_terms + job_terms))
    return [
        job,
        f"{persona} {job}",
        joined,
    ]


def _idf_weights(sections: List[Dict]) -> Dict[str, float]:
    # Simple IDF over section titles + text (lowercased)
    doc_count = len(sections)
    term_docs: Dict[str, int] = {}
    for s in sections:
        text = (s.get('title', '') + ' ' + s.get('text', '')).lower()
        terms = set(t for t in re.findall(r"[a-zA-Z]{3,}", text))
        for t in terms:
            term_docs[t] = term_docs.get(t, 0) + 1
    return {t: math.log((doc_count + 1) / (df + 0.5)) + 1.0 for t, df in term_docs.items()}


def rank_sections(sections: List[Dict], persona: str, job: str, top_n: int = 5) -> List[Dict]:
    """
    Rank sections by relevance to persona and job-to-be-done using semantic similarity
    """
    # Create focused queries and lexical supports
    queries = _build_queries(persona, job)
    # Build a compact keyword list from persona+job
    keyword_text = f"{persona} {job}".lower()
    keyword_terms = tokenize_words(keyword_text)
    keyword_bigrams = build_bigrams(keyword_terms)
    
    # Calculate scores for each query variation
    all_scores = []
    # Prepare normalized text and embeddings
    section_titles = [s.get('title', '') for s in sections]
    section_bodies = [s.get('text', '') for s in sections]
    normalized_bodies = [normalize_text(b) for b in section_bodies]
    section_texts = [f"{t}\n{b}" for t, b in zip(section_titles, normalized_bodies)]
    # Cached batch encoding for speed & determinism across reruns
    import torch
    np_embs = encode_texts_with_cache(model, section_texts, batch_size=32, normalize=True)
    section_embs = torch.from_numpy(np_embs)

    # Build BM25 over title + text tokens
    corpus_tokens = [tokenize_words(f"{t} {b}") for t, b in zip(section_titles, normalized_bodies)]
    bm25 = BM25Okapi(corpus_tokens) if corpus_tokens else None

    for query in queries:
        query_norm = normalize_text(query)
        import torch
        q_np = encode_texts_with_cache(model, [query_norm], batch_size=1, normalize=True)
        query_emb = torch.from_numpy(q_np)
        scores = util.cos_sim(query_emb, section_embs)[0].cpu().tolist()
        all_scores.append(scores)
    
    # Use the maximum semantic score across query variants
    max_scores = [max(scores) for scores in zip(*all_scores)]

    # Compute BM25 scores (normalized 0..1 by max)
    bm25_scores = [0.0] * len(sections)
    if bm25 is not None:
        bm25_all = [0.0] * len(sections)
        for query in queries:
            q_tokens = tokenize_words(query)
            q_scores = bm25.get_scores(q_tokens)
            # Keep max over queries
            bm25_all = [max(prev, float(q)) for prev, q in zip(bm25_all, q_scores)]
        max_bm25 = max(bm25_all) if bm25_all else 1.0
        if max_bm25 <= 0:
            max_bm25 = 1.0
        bm25_scores = [s / max_bm25 for s in bm25_all]
    
    # Calculate comprehensive scores for each section
    idf = _idf_weights(sections)
    for idx, (s, sem_sc) in enumerate(zip(sections, max_scores)):
        # Base semantic similarity score (normalized cosine already in [-1,1]; use non-negative)
        semantic_score = max(0.0, sem_sc) * 0.65
        lexical_score = bm25_scores[idx] * 0.20
        
        # Heading level boost (H1 > H2 > H3)
        level_boost = LEVEL_SCORE.get(s.get('level', 'H3'), 0.5) * 0.1
        
        # Page position boost (earlier pages are often more important)
        page_boost = 1.0 / max(1, s.get('page_number', 1)) * 0.05
        
        # Actionable content boost
        actionable_boost = 0.05 if is_actionable_section(s) else 0.0
        
        # Content length boost (prefer sections with substantial content)
        length = len(s.get('text', ''))
        if 250 < length < 5000:
            length_boost = 0.05
        else:
            length_boost = -0.1
        
        # Title quality boost
        title_quality = 0.07 if is_clean_title(s.get('title', '')) else -0.07
        
        # Contextual relevance boost based on job requirements
        # This uses the job description itself to create a relevance score
        job_terms = [t for t in re.split(r"[,/;\-]\s*|\s+", job.lower()) if len(t) > 3]
        section_text = (s.get('title', '') + ' ' + s.get('text', '')).lower()
        contextual_matches = sum(1 for term in job_terms if term in section_text and len(term) > 3)
        # IDF-weighted presence boost
        idf_boost = sum(idf.get(term, 0.0) for term in job_terms if term in section_text)
        idf_boost = min(idf_boost * 0.02, 0.10)
        contextual_boost = min(contextual_matches * 0.03, 0.12) + idf_boost

        # Phrase/heading boosts
        # Bigram phrase in body
        bigram_body_boost = 0.0
        if keyword_bigrams:
            body_tokens = tokenize_words(section_text)
            body_pairs = set((body_tokens[i], body_tokens[i + 1]) for i in range(len(body_tokens) - 1))
            if any(bg in body_pairs for bg in keyword_bigrams):
                bigram_body_boost = 0.10

        # Match in title/heading
        heading_boost = 0.0
        title_low = s.get('title', '').lower()
        if any(t in title_low for t in keyword_terms):
            heading_boost += 0.10
        if keyword_bigrams:
            title_tokens = tokenize_words(title_low)
            title_pairs = set((title_tokens[i], title_tokens[i + 1]) for i in range(len(title_tokens) - 1))
            if any(bg in title_pairs for bg in keyword_bigrams):
                heading_boost += 0.05
        

        
        # Combine all scores
        s['score'] = (
            semantic_score
            + lexical_score
            + level_boost
            + page_boost
            + actionable_boost
            + length_boost
            + title_quality
            + contextual_boost
            + bigram_body_boost
            + heading_boost
        )
    
    # Sort with embedding-based MMR for diversity
    ordered = sorted(sections, key=lambda x: x['score'], reverse=True)

    # Optional small cross-encoder rerank on top-N candidates for precision@K
    if ranks_cross is not None and ordered:
        top_pool = ordered[: min(len(ordered), max(10, top_n * 3))]
        pairs = [(f"{persona} {job}", f"{s.get('title','')}. {normalize_text(s.get('text',''))}") for s in top_pool]
        try:
            ce_scores = ranks_cross.predict(pairs)
            for sc, s in zip(ce_scores, top_pool):
                s['_ce'] = float(sc)
            ordered = sorted(top_pool, key=lambda x: (x.get('_ce', 0.0), x['score']), reverse=True) + ordered[len(top_pool):]
        except Exception:
            # Fail open if cross-encoder unavailable
            pass
    selected: List[Dict] = []
    selected_idx: List[int] = []
    # Tunable diversity via env (default 0.3)
    import os
    try:
        diversity = float(os.getenv('DIVERSITY', '0.3'))
    except Exception:
        diversity = 0.3

    # Precompute embeddings for candidate titles+bodies
    cand_texts = [f"{s.get('title','')}\n{s.get('text','')}" for s in ordered]
    cand_embs = model.encode(cand_texts, convert_to_tensor=True)

    for i, candidate in enumerate(ordered):
        if len(selected) < top_n:
            selected.append(candidate)
            selected_idx.append(i)
            continue
        # Compute max similarity to any already selected
        sim_to_selected = 0.0
        if selected_idx:
            sel_embs = cand_embs[selected_idx]
            this_emb = cand_embs[i].unsqueeze(0)
            sims = util.cos_sim(this_emb, sel_embs)[0].cpu().tolist()
            sim_to_selected = max(sims) if sims else 0.0
        mmr_score = candidate['score'] - diversity * sim_to_selected
        # Replace the worst if improved mmr
        worst_idx = min(range(len(selected)), key=lambda j: selected[j].get('_mmr', selected[j]['score']))
        worst_mmr = selected[worst_idx].get('_mmr', selected[worst_idx]['score'])
        if mmr_score > worst_mmr:
            candidate['_mmr'] = mmr_score
            selected[worst_idx] = candidate
            selected_idx[worst_idx] = i
    ranked = sorted(selected, key=lambda x: x.get('_mmr', x['score']), reverse=True)[:top_n]
    # Attach improved snippet for each ranked section
    query_terms_all = tokenize_words(f"{persona} {job}")
    for r in ranked:
        r['snippet'] = select_snippet(r.get('text', ''), query_terms_all)
    for r in ranked:
        if '_mmr' in r:
            del r['_mmr']
    
    return ranked

if __name__ == "__main__":
    print("Embedding model ready:", type(model).__name__)