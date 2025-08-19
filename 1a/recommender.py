import os
import json
from typing import List, Dict, Tuple

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


def load_sections_from_output(json_data: Dict) -> List[Dict]:
    """
    Loads sections from the 1b output JSON structure and aligns refined text by page.
    Returns a list of dicts with keys: 'document', 'section_title', 'text', 'page_number'.
    """
    section_map: Dict[Tuple[str, int], str] = {}
    for sub in json_data.get('subsection_analysis', []):
        key = (sub.get('document', ''), sub.get('page_number', 1))
        section_map[key] = sub.get('refined_text', '')

    sections: List[Dict] = []
    for sec in json_data.get('extracted_sections', []):
        key = (sec.get('document', ''), sec.get('page_number', 1))
        refined_text = section_map.get(key, '')
        sections.append({
            'document': sec.get('document', ''),
            'section_title': sec.get('section_title', ''),
            'text': refined_text,
            'page_number': sec.get('page_number', 1)
        })
    return sections


def build_faiss_index(sections: List[Dict], model: SentenceTransformer):
    texts = [section['text'] for section in sections]
    if not texts:
        # Create a 1-dim dummy index to avoid errors
        dim = 1
        index = faiss.IndexFlatIP(dim)
        embeddings = np.zeros((1, dim), dtype='float32')
        index.add(embeddings)
        return index, embeddings

    embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)  # Cosine similarity with normalized vectors
    index.add(embeddings)
    return index, embeddings


def generate_snippet(current_text: str, candidate_text: str) -> str:
    import re
    sentences = re.split(r'(?<=[.!?])\s+', candidate_text.strip())
    return sentences[0] if sentences else candidate_text[:160]


def recommend_similar_sections(current_section: Dict, all_sections: List[Dict], model: SentenceTransformer, top_k: int = 3) -> List[Dict]:
    index, _ = build_faiss_index(all_sections, model)
    query_emb = model.encode([current_section.get('text', '')], convert_to_numpy=True, normalize_embeddings=True)
    D, I = index.search(query_emb, min(top_k + 1, len(all_sections)))

    recommendations: List[Dict] = []
    for idx, score in zip(I[0], D[0]):
        if idx < 0 or idx >= len(all_sections):
            continue
        # Skip the section itself
        if all_sections[idx].get('text', '') == current_section.get('text', ''):
            continue
        recommendations.append({
            'document': all_sections[idx]['document'],
            'section_title': all_sections[idx]['section_title'],
            'page_number': all_sections[idx]['page_number'],
            'similarity': float(score),
            'snippet': generate_snippet(current_section.get('text', ''), all_sections[idx].get('text', ''))
        })
        if len(recommendations) >= top_k:
            break
    return recommendations


def generate_recommendations_for_output(output_json_path: str, top_k: int = 3) -> Dict:
    with open(output_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    sections = load_sections_from_output(data)

    # Use the same model as ranker for consistency
    model = SentenceTransformer('paraphrase-distilroberta-base-v2', device='cpu')

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

    return {
        'metadata': data.get('metadata', {}),
        'recommendations': results
    }


def _default_output_path(output_json_path: str) -> str:
    base_dir = os.path.dirname(output_json_path)
    return os.path.join(base_dir, 'recommendations_output.json')


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Generate related section recommendations from 1b output JSON')
    parser.add_argument('--input', dest='input_path', required=False,
                        help='Path to challenge1b_output.json. If not provided, will search in ../1b/output/**/challenge1b_output.json')
    parser.add_argument('--top-k', dest='top_k', type=int, default=3, help='Number of recommendations per section')
    parser.add_argument('--out', dest='out_path', default=None, help='Path to write recommendations_output.json')
    args = parser.parse_args()

    # Discover default input if not provided
    input_path = args.input_path
    if not input_path:
        # Search a likely default in repo
        candidate = None
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        for root, _dirs, files in os.walk(repo_root):
            for name in files:
                if name == 'challenge1b_output.json':
                    candidate = os.path.join(root, name)
                    break
            if candidate:
                break
        if not candidate:
            raise FileNotFoundError('Could not find challenge1b_output.json. Provide --input path explicitly.')
        input_path = candidate

    output = generate_recommendations_for_output(input_path, top_k=args.top_k)

    out_path = args.out_path or _default_output_path(input_path)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f'Recommendations saved to {out_path}')


