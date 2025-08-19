# outline_extractor.py
# Functions for robust, multilingual title and heading extraction
import fitz
import re

def extract_outline(pdf_path):
    doc = fitz.open(pdf_path)
    headings = []
    title = ""
    
    # Process more pages to find subsections while keeping performance reasonable
    max_pages = min(10, len(doc))
    
    # Analyze first page for title candidates
    first_page = doc[0]
    text_dict = first_page.get_text("dict")
    title_candidates = []
    for block in text_dict["blocks"]:
        if "lines" not in block:
            continue
        block_text = ""
        max_size = 0
        is_bold = False
        y_position = float('inf')
        for line in block["lines"]:
            for span in line["spans"]:
                block_text += span["text"]
                max_size = max(max_size, span["size"])
                if span["flags"] & 2**4:
                    is_bold = True
                y_position = min(y_position, span["bbox"][1])
        block_text = block_text.strip()
        if 10 < len(block_text) < 200:
            title_candidates.append({
                "text": block_text,
                "size": max_size,
                "bold": is_bold,
                "position": y_position
            })
    # Pick the largest, boldest, topmost block as title
    if title_candidates:
        best = max(title_candidates, key=lambda x: (x["bold"], x["size"], -x["position"]))
        title = best["text"]

    # Simplified font size analysis (only first 2 pages)
    font_sizes = set()
    for page_num in range(min(2, len(doc))):
        text_dict = doc[page_num].get_text("dict")
        for block in text_dict["blocks"]:
            if "lines" not in block:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    font_sizes.add(span["size"])
    
    # Find the most common font size (body text) using a rounded histogram
    if font_sizes:
        from collections import Counter
        rounded_sizes = [round(s, 1) for s in font_sizes]
        body_size = Counter(rounded_sizes).most_common(1)[0][0]
    else:
        body_size = 12.0
    sorted_sizes = sorted(set(rounded_sizes), reverse=True) if font_sizes else [body_size]

    # Assign heading levels based on font size and heuristics
    def get_level(size, block_text):
        # Assign heading levels relative to the detected body text size
        if size >= body_size + 2:
            return "H1"
        elif size >= body_size + 1:
            return "H2"
        elif re.match(r"^\d+(\.|:)\s", block_text) or block_text.isupper():
            return "H2"
        else:
            return "H3"

    # Extract headings based on font size, boldness, and heuristics
    seen_norm_titles = set()
    for page_num in range(max_pages):
        page = doc[page_num]
        text_dict = page.get_text("dict")
        page_height = page.rect.height
        for block in text_dict["blocks"]:
            if "lines" not in block:
                continue
            block_text = ""
            max_size = 0
            is_bold = False
            min_indent = float('inf')
            min_y = float('inf')
            max_y = 0.0
            for line in block["lines"]:
                for span in line["spans"]:
                    block_text += span["text"]
                    max_size = max(max_size, span["size"])
                    if span["flags"] & 2**4:
                        is_bold = True
                    min_indent = min(min_indent, span["bbox"][0])
                    min_y = min(min_y, span["bbox"][1])
                    max_y = max(max_y, span["bbox"][3])
            block_text = block_text.strip()
            # Filter: skip very short/long, all-caps non-descriptive, or non-headings
            if not block_text or len(block_text) < 3 or len(block_text) > 150:
                continue
            if block_text.startswith("•") or block_text.startswith("-") or block_text.startswith("*"):
                continue
            if block_text.lower() in ["introduction", "contents", "table of contents", "index"]:
                continue
            if sum(c.isalpha() for c in block_text) < 2:
                continue
            # Skip document titles (usually very long and generic)
            if len(block_text) > 80 and any(phrase in block_text.lower() for phrase in ["comprehensive guide", "ultimate guide", "complete guide", "journey through", "travel companion"]):
                continue
            # Skip probable headers/footers (very top/bottom of the page)
            if min_y < 30 or max_y > (page_height - 40):
                continue

            # Heuristic: heading if font size is larger than body, bold, all-caps, numbered/indented
            # Use thresholds relative to detected body text size; prioritize concise headings
            is_heading = (
                (max_size >= body_size + 0.5 and len(block_text) < 90) or
                (is_bold and max_size >= body_size and len(block_text) < 70) or
                (block_text.isupper() and len(block_text) < 50) or
                re.match(r"^\d+(\.|:)\s", block_text) or
                (min_indent < 50 and max_size >= body_size and len(block_text) < 80)
            )
            if is_heading:
                # Normalize to reduce duplicates (strip numbering and punctuation)
                norm = re.sub(r"^\s*[\dA-Za-z]+[\.:\)]\s+", "", block_text).strip().lower()
                norm = re.sub(r"\s+", " ", norm)
                if norm in seen_norm_titles:
                    continue
                seen_norm_titles.add(norm)
                headings.append({
                    "title": block_text,
                    "page_number": page_num + 1,
                    "font_size": max_size,
                    "bold": is_bold,
                    "level": get_level(max_size, block_text),
                    "indent": min_indent
                })
    
    doc.close()
    return {"title": title, "headings": headings} 