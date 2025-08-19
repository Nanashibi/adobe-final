try:
    import faiss  # type: ignore
    FAISS_AVAILABLE = True
except Exception:
    faiss = None  # type: ignore
    FAISS_AVAILABLE = False
import numpy as np
from sentence_transformers import SentenceTransformer
from models import get_embedding_model
from embeddings_cache import encode_texts_with_cache

def load_sections_from_output(json_data):
    """
    Loads sections from the output JSON structure.
    Returns a list of dicts with 'document', 'section_title', 'refined_text', and 'page_number'.
    """
    # Map section titles to refined_text using page_number and document
    section_map = {}
    for sub in json_data['subsection_analysis']:
        key = (sub['document'], sub['page_number'])
        section_map[key] = sub['refined_text']

    sections = []
    for sec in json_data['extracted_sections']:
        key = (sec['document'], sec['page_number'])
        refined_text = section_map.get(key, "")
        sections.append({
            'document': sec['document'],
            'section_title': sec['section_title'],
            'text': refined_text,
            'page_number': sec['page_number']
        })
    return sections

def build_faiss_index(sections, model):
    """
    Builds a FAISS index from a list of section texts.
    Returns the index and the embeddings.
    """
    texts = [section['text'] for section in sections]
    embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    if FAISS_AVAILABLE and len(texts) > 0:
        dim = embeddings.shape[1]
        index = faiss.IndexFlatIP(dim)  # Cosine similarity (with normalized vectors)
        index.add(embeddings)
        return index, embeddings
    return None, embeddings

def recommend_similar_sections(current_section, all_sections, model, top_k=3):
    """
    Given a current section, recommend top_k similar sections from all_sections.
    Returns a list of recommended section dicts with similarity scores.
    """
    index, embeddings = build_faiss_index(all_sections, model)
    query_emb = encode_texts_with_cache(model, [current_section['text']], batch_size=1, normalize=True)

    if index is not None and FAISS_AVAILABLE:
        D, I = index.search(query_emb, min(top_k + 1, len(all_sections)))
        indices = I[0]
        scores = D[0]
    else:
        # NumPy fallback for cosine similarity (embeddings are normalized)
        sims = embeddings @ query_emb[0].T
        top_count = min(top_k + 1, sims.shape[0])
        indices = np.argpartition(-sims, range(top_count))[:top_count]
        indices = indices[np.argsort(-sims[indices])]
        scores = sims[indices]

    recommended = []
    for idx, score in zip(indices, scores):
        # Skip if it's the current section itself
        if all_sections[idx]['text'] == current_section['text']:
            continue
        recommended.append({
            'document': all_sections[idx]['document'],
            'section_title': all_sections[idx]['section_title'],
            'page_number': all_sections[idx]['page_number'],
            'similarity': float(score),
            'snippet': generate_snippet(current_section['text'], all_sections[idx]['text'])
        })
        if len(recommended) == top_k:
            break
    return recommended

def generate_snippet(current_text, candidate_text):
    """
    Generates a short snippet (1-2 sentences) explaining relevance.
    For now, returns the first sentence of the candidate section.
    """
    import re
    sentences = re.split(r'(?<=[.!?])\s+', candidate_text.strip())
    return sentences[0] if sentences else candidate_text[:120]

def generate_recommendations_for_output(output_json_path: str, top_k: int = 3):
    """
    Read a 1b output JSON and return a structured recommendations object:
    {
      'metadata': {...},
      'recommendations': [
         { 'source': {...}, 'recommendations': [ {doc,title,page,similarity,snippet}... ] }, ...
      ]
    }
    """
    import json
    with open(output_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    sections = load_sections_from_output(data)
    # Shared embedding model for consistency with ranker
    model: SentenceTransformer = get_embedding_model()

    results = []
    for section in sections:
        recs = recommend_similar_sections(section, sections, model, top_k=top_k)
        results.append({
            'source': {
                'document': section['document'],
                'section_title': section['section_title'],
                'page_number': section['page_number']
            },
            'recommendations': recs
        })

    return { 'metadata': data.get('metadata', {}), 'recommendations': results }

# Example CLI usage for local testing
if __name__ == "__main__":
    import json
    import argparse
    import os

    parser = argparse.ArgumentParser(description="Generate recommendations from 1b output JSON")
    parser.add_argument("--input", required=True, help="Path to challenge1b_output.json")
    parser.add_argument("--top-k", type=int, default=3)
    args = parser.parse_args()

    recs_obj = generate_recommendations_for_output(args.input, top_k=args.top_k)
    output_path = os.path.join(os.path.dirname(args.input), 'recommendations_output.json')
    with open(output_path, 'w', encoding='utf-8') as out_f:
        json.dump(recs_obj, out_f, ensure_ascii=False, indent=2)
    print(f"Recommendations saved to {output_path}")