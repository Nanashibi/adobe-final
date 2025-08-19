# section_extractor.py
# Functions for extracting section text from PDF based on outline
import fitz
import re
from typing import List, Dict

def is_clean_title(title):
    # Filter out UI strings, partials, and random list items
    title = title.strip()
    if not title or len(title) < 3:
        return False
    if title.lower() in ["page", "page 1", "table of contents", "contents", "index", "click here", "introduction"]:
        return False
    if title.startswith(("•", "-", "*", "(", "[", "#")):
        return False
    if title[:3].isdigit() and title[3] in ".- ":
        return False
    if re.match(r"^[A-Za-z]$", title):
        return False
    if sum(c.isalpha() for c in title) < 2:
        return False
    # Avoid titles that are just numbers or symbols
    if re.match(r"^[\d\W_]+$", title):
        return False
    # Filter out partial content
    if re.match(r"^[o•]\s+\d+", title):
        return False
    if title.endswith('.') and len(title) < 8:
        return False
    # Avoid titles that are just single words (unless they're meaningful)
    if len(title.split()) <= 1 and len(title) < 6:
        return False
    return True

def _clean_page_text(text: str) -> str:
    # Remove common header/footer patterns and excessive whitespace
    # 1) Standalone page numbers
    text = re.sub(r"\n\s*\d+\s*\n", "\n", text)
    # 2) Lines with only page counts like '12 / 34'
    text = re.sub(r"^\s*\d+\s*/\s*\d+\s*$", "", text, flags=re.MULTILINE)
    # 3) Repeated header/footer lines across pages heuristically (short, repeated phrases)
    lines = [l.strip() for l in text.splitlines()]
    freq: Dict[str, int] = {}
    for l in lines:
        if 3 <= len(l) <= 60:
            freq[l] = freq.get(l, 0) + 1
    common = {k for k, v in freq.items() if v >= 3}
    lines = [l for l in lines if l not in common]
    text = "\n".join(lines)
    text = re.sub(r"\s{3,}", "  ", text)
    text = re.sub(r"(\n\s*){3,}", "\n\n", text)
    return text.strip()


def extract_sections(pdf_path: str, outline: Dict) -> List[Dict]:
    doc = fitz.open(pdf_path)
    headings = outline["headings"]
    sections = []
    
    if not headings:
        # Fallback: treat the whole document as one section (limit to first 3 pages for speed)
        full_text = ""
        for i in range(min(3, len(doc))):
            full_text += doc[i].get_text()
        sections.append({
            "title": outline["title"] or "Document",
            "text": full_text,
            "page_number": 1
        })
        doc.close()
        return sections

    # Sort headings by page then by descending font size to prioritize more prominent headings
    headings = sorted(headings, key=lambda h: (h["page_number"], -h.get("font_size", 0)))
    
    for idx, heading in enumerate(headings):
        if not is_clean_title(heading["title"]):
            continue  # Skip bad/partial/UI titles
        
        start_page = heading["page_number"] - 1
        next_page = headings[idx + 1]["page_number"] - 1 if idx + 1 < len(headings) else len(doc)
        # Expand pages based on heading level; H1 can span more than H3
        max_span = 3 if heading.get("level") == "H1" else 2 if heading.get("level") == "H2" else 2
        tentative_end = min(len(doc), start_page + max_span)
        end_page = min(next_page, tentative_end)
        
        section_text = ""
        for p in range(start_page, end_page):
            section_text += doc[p].get_text()
        
        # Fallback: if section_text is empty, use the full page text
        if not section_text.strip():
            section_text = doc[start_page].get_text()

        section_text = _clean_page_text(section_text)
        
        # Limit text length for memory efficiency while keeping more context
        if len(section_text) > 5000:
            section_text = section_text[:5000]
        
        sections.append({
            "title": heading["title"],
            "text": section_text.strip(),
            "page_number": heading["page_number"],
            "level": heading.get("level", "H3")
        })
    
    doc.close()
    return sections 