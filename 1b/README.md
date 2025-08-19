# PDF Document Analysis and Section Extraction

## Overview

This application performs intelligent document analysis on PDF collections to extract and rank the most relevant sections based on user personas and job requirements. The system uses advanced natural language processing techniques to identify, extract, and prioritize content that matches specific user needs.

## Approach and Technology

The solution employs a multi-stage pipeline combining PDF processing, semantic analysis, and text summarization:

**1. Document Structure Analysis**: Uses PyMuPDF to extract document outlines, headings, and hierarchical structure from PDF files. The system identifies section titles through font size analysis, formatting detection, and heuristic-based filtering.

**2. Content Extraction**: Extracts text content for each identified section while maintaining page references and document context. The extraction process is optimized for performance by limiting scope to relevant pages.

**3. Semantic Ranking**: Implements semantic similarity matching using the `paraphrase-distilroberta-base-v2` sentence transformer model. This CPU-optimized model generates embeddings for both user queries (persona + job requirements) and document sections, computing cosine similarity scores to rank relevance.

**4. Text Summarization**: Applies dual summarization strategies - TextRank algorithm via Sumy library for extractive summarization, with fallback to semantic similarity-based sentence selection. This ensures concise, relevant content extraction.

**5. Scoring System**: Combines multiple factors including semantic similarity, document structure hierarchy, content actionability, page positioning, and contextual term matching to produce comprehensive relevance scores.

The system operates entirely on CPU with a memory footprint under 1GB, making it suitable for resource-constrained environments. No user interaction is required - the application automatically processes all collections in the input directory and generates structured JSON outputs with metadata, ranked sections, and refined text analysis.

## Prerequisites

- Docker installed on your system
- Input PDF collections prepared in the required directory structure

## Setup and Execution

1. **Create required directories**:
   ```bash
   mkdir -p input output
   ```

2. **Prepare input data**: Place your PDF collections in the `input` folder following this structure:
   ```
   input/
   ├── Collection 1/
   │   ├── challenge1b_input.json
   │   └── PDFs/
   │       └── [your PDF files]
   ├── Collection 2/
   │   ├── challenge1b_input.json
   │   └── PDFs/
   │       └── [your PDF files]
   ```

3. **Build the Docker image**:
   ```bash
   wdocker build --platform linux/amd64 -t 1b .
   ```

4. **Run the application**:
   ```bash
   docker run --rm -v $(pwd)/input:/app/input:ro -v $(pwd)/output:/app/output --network none 1b
   ```

## Output

Results will be available in the `output/` directory as structured JSON files containing:
- Document metadata and processing timestamps
- Ranked sections with importance scores
- Refined text analysis with page references

The application will display "Processing completed successfully. Results available in output directory." when finished.