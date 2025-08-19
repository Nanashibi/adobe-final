#!/usr/bin/env python3
"""
Real-time text selection search for Adobe Hackathon
Finds semantically similar sections across documents
"""

import json
import sys
import numpy as np
from typing import List, Dict, Any
from models import get_embedding_model
from embeddings_cache import encode_texts_with_cache

def search_similar_sections(selected_text: str, sections: List[Dict], top_k: int = 5, original_text: str = None) -> List[Dict]:
    """
    Find sections similar to the selected text using semantic similarity
    
    Args:
        selected_text: The enriched search query (may include context)
        sections: List of sections to search through
        top_k: Number of top results to return
        original_text: The original selected text (for logging)
        
    Returns:
        List of similar sections with similarity scores
    """
    if not selected_text.strip() or not sections:
        return []
    
    try:
        model = get_embedding_model()
        
        # Prepare section texts (combine title and content)
        section_texts = []
        for section in sections:
            title = section.get('section_title', '')
            text = section.get('refined_text', section.get('text', ''))
            combined = f"{title}\n{text}" if title else text
            section_texts.append(combined)
        
        if not section_texts:
            return []
        
        # Get embeddings for selected text and all sections
        query_emb = encode_texts_with_cache(model, [selected_text], batch_size=1, normalize=True)
        section_embs = encode_texts_with_cache(model, section_texts, batch_size=32, normalize=True)
        
        # Compute cosine similarities
        similarities = np.dot(section_embs, query_emb[0])
        
        # Get top-k most similar sections
        top_indices = np.argpartition(-similarities, min(top_k, len(similarities) - 1))[:top_k]
        top_indices = top_indices[np.argsort(-similarities[top_indices])]
        
        results = []
        for idx in top_indices:
            if similarities[idx] > 0.1:  # Minimum similarity threshold
                section = sections[idx].copy()
                section['similarity'] = float(similarities[idx])
                section['text'] = section.get('refined_text', section.get('text', ''))
                results.append(section)
        
        return results
        
    except Exception as e:
        print(f"Search error: {e}", file=sys.stderr)
        return []

def main():
    """Main function to handle stdin/stdout communication"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        selected_text = input_data.get('selected_text', '')
        original_text = input_data.get('original_text', selected_text)  # Fallback to selected_text
        sections = input_data.get('sections', [])
        top_k = input_data.get('top_k', 5)
        
        # Log context-aware search if enhanced
        if original_text != selected_text:
            print(f"Context-enhanced search: '{original_text}' -> '{selected_text[:100]}...'", file=sys.stderr)
        
        # Perform search with context-aware query
        results = search_similar_sections(selected_text, sections, top_k, original_text)
        
        # Output results to stdout
        print(json.dumps(results, ensure_ascii=False))
        
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}", file=sys.stderr)
        print("[]")  # Empty results
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        print("[]")  # Empty results

if __name__ == "__main__":
    main()
