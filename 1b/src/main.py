import os
import json
from datetime import datetime
from outline_extractor import extract_outline
from section_extractor import extract_sections
import os
from ranker import rank_sections, model
from sentence_transformers import util
import re
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.text_rank import TextRankSummarizer
from recommender import generate_recommendations_for_output
from typing import List

def _select_non_overlapping(sentences: List[str], top_k: int) -> List[str]:
    selected: List[str] = []
    for s in sentences:
        norm = re.sub(r"\s+", " ", s.lower()).strip()
        # Skip if largely overlapping with already selected sentences
        tokens = set(norm.split())
        too_similar = False
        for t in selected:
            t_tokens = set(t.lower().split())
            if not tokens or not t_tokens:
                continue
            jacc = len(tokens & t_tokens) / max(1, len(tokens | t_tokens))
            if jacc > 0.6:
                too_similar = True
                break
        if too_similar:
            continue
        selected.append(s)
        if len(selected) >= top_k:
            break
    return selected


def extract_sumy_summary(text, num_sentences=1):
    """Extract summary using TextRank algorithm with overlap filtering"""
    try:
        parser = PlaintextParser.from_string(text, Tokenizer("english"))
        summarizer = TextRankSummarizer()
        # Take more candidates than needed, then filter
        candidates = [str(s) for s in summarizer(parser.document, max(1, num_sentences * 2))]
        chosen = _select_non_overlapping(candidates, num_sentences)
        return ' '.join(chosen)
    except Exception:
        return text[:500]  # Fallback if summarization fails

def extract_best_sentences(section, persona, job, max_sentences=1):
    """Extract the most relevant sentences from a section based on persona and job"""
    # Try TextRank summary first
    summary = extract_sumy_summary(section['text'], num_sentences=max_sentences)
    if summary.strip():
        return summary
    
    # Fallback to semantic similarity method
    sentences = re.split(r'(?<=[.!?])\s+', section['text'])
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]
    if not sentences:
        return section['text'][:500]  # fallback if no sentences found
    
    query = persona + ' ' + job
    query_emb = model.encode(query, convert_to_tensor=True)
    sent_embs = model.encode(sentences, convert_to_tensor=True)
    scores = util.cos_sim(query_emb, sent_embs)[0].cpu().tolist()
    ranked = [i for i, _ in sorted(enumerate(scores), key=lambda x: x[1], reverse=True)]
    picked: List[str] = []
    for idx in ranked:
        if len(picked) >= max_sentences:
            break
        cand = sentences[idx]
        # Avoid redundancy with already picked sentences
        if picked and any(
            len(set(cand.lower().split()) & set(p.lower().split())) / max(1, len(set(cand.lower().split()) | set(p.lower().split()))) > 0.6
            for p in picked
        ):
            continue
        picked.append(cand)
    return ' '.join(picked)


def _normalize_text_for_hash(text: str) -> List[str]:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    tokens = [t for t in text.split() if len(t) >= 3]
    return tokens


def _jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / max(1, len(a | b))


def _section_quality(s: dict) -> float:
    length = len(s.get('text', ''))
    level = s.get('level', 'H3')
    level_score = 1.0 if level == 'H1' else 0.8 if level == 'H2' else 0.6
    early_page_bonus = 1.0 / max(1, s.get('page_number', 1))
    return level_score * 0.5 + min(length, 4000) / 4000 * 0.4 + early_page_bonus * 0.1


def deduplicate_sections(sections: List[dict], similarity_threshold: float = 0.85) -> List[dict]:
    """Remove near-duplicate sections based on Jaccard similarity of token sets."""
    normalized_sets: List[set] = [set(_normalize_text_for_hash(s.get('text', ''))) for s in sections]
    kept: List[int] = []
    for i, s in enumerate(sections):
        is_dup = False
        for k_idx in kept:
            if _jaccard(normalized_sets[i], normalized_sets[k_idx]) >= similarity_threshold:
                # keep the higher-quality one
                better = i if _section_quality(sections[i]) > _section_quality(sections[k_idx]) else k_idx
                if better == i:
                    kept.remove(k_idx)
                    kept.append(i)
                is_dup = True
                break
        if not is_dup:
            kept.append(i)
    return [sections[i] for i in kept]

def main():
    # Use paths relative to script location for robustness
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_root = os.path.join(base_dir, '..', 'input')
    output_root = os.path.join(base_dir, '..', 'output')
    only_collection = os.getenv('COLLECTION_ID')

    # Process each collection in the input directory
    for collection in os.listdir(input_root):
        if only_collection and collection != only_collection:
            continue
        collection_path = os.path.join(input_root, collection)
        if not os.path.isdir(collection_path):
            continue

        # Read the official input JSON
        input_json_path = os.path.join(collection_path, 'challenge1b_input.json')
        if not os.path.exists(input_json_path):
            continue
        with open(input_json_path, 'r', encoding='utf-8') as f:
            input_data = json.load(f)

        persona = input_data['persona']['role']
        job = input_data['job_to_be_done']['task']
        documents = input_data['documents']
        pdf_dir = os.path.join(collection_path, 'PDFs')

        # Extract all sections from all documents
        all_sections = []
        for doc in documents:
            pdf_filename = doc['filename']
            pdf_path = os.path.join(pdf_dir, pdf_filename)
            
            try:
                outline = extract_outline(pdf_path)
                sections = extract_sections(pdf_path, outline)
                for s in sections:
                    s['document'] = pdf_filename
                all_sections.extend(sections)
            except Exception as e:
                continue

        # Generalized deduplication across all extracted sections
        if all_sections:
            all_sections = deduplicate_sections(all_sections, similarity_threshold=0.82)

        if not all_sections:
            # Create a minimal fallback output
            output = {
                'metadata': {
                    'input_documents': [doc['filename'] for doc in documents],
                    'persona': persona,
                    'job_to_be_done': job,
                    'processing_timestamp': datetime.now().isoformat()
                },
                'extracted_sections': [],
                'subsection_analysis': []
            }
        else:
            # Rank sections by relevance to persona and job
            try:
                top_n = int(os.getenv('TOP_N', '5'))
            except Exception:
                top_n = 5
            top_sections = rank_sections(all_sections, persona, job, top_n=top_n)

            # Extract refined text for each top section
            subsection_analysis = []
            for sec in top_sections:
                best_sents = extract_best_sentences(sec, persona, job, max_sentences=3)
                subsection_analysis.append({
                    'document': sec['document'],
                    'refined_text': best_sents,
                    'page_number': sec.get('page_number', 1)
                })

            # Prepare output JSON
            output = {
                'metadata': {
                    'input_documents': [doc['filename'] for doc in documents],
                    'persona': persona,
                    'job_to_be_done': job,
                    'processing_timestamp': datetime.now().isoformat()
                },
                'extracted_sections': [
                    {
                        'document': sec['document'],
                        'section_title': sec.get('title', ''),
                        'importance_rank': i+1,
                        'page_number': sec.get('page_number', 1)
                    } for i, sec in enumerate(top_sections)
                ],
                'subsection_analysis': subsection_analysis
            }

        # Write output JSON
        output_dir = os.path.join(output_root, collection)
        os.makedirs(output_dir, exist_ok=True)
        output_json_path = os.path.join(output_dir, 'challenge1b_output.json')
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=4, ensure_ascii=False)

        # Generate recommendations JSON alongside output
        try:
            recs = generate_recommendations_for_output(output_json_path, top_k=3)
            recs_path = os.path.join(output_dir, 'recommendations_output.json')
            with open(recs_path, 'w', encoding='utf-8') as rf:
                json.dump(recs, rf, indent=4, ensure_ascii=False)
        except Exception:
            pass

        # Generate library-wide recommendations (across past collections)
        try:
            from library_index import build_and_save_library, generate_library_recommendations_for_output
            # Ensure library index exists (incremental rebuild when new outputs land)
            build_and_save_library(rebuild=False)
            lib = generate_library_recommendations_for_output(output_json_path, top_k=3)
            lib_path = os.path.join(output_dir, 'library_recommendations.json')
            with open(lib_path, 'w', encoding='utf-8') as lf:
                json.dump(lib, lf, indent=4, ensure_ascii=False)
        except Exception:
            pass

    print("Processing completed successfully. Results available in output directory.")

if __name__ == "__main__":
    main() 