# Adobe India Hackathon 2025 - Document Intelligence System

## 🎯 **Solution Overview**

An interactive PDF reading experience that **connects the dots** across documents using AI-powered semantic search, real-time text selection, and cross-document insights.

### **Key Innovation: Text Selection → Instant Cross-Document Discovery**

When users select text while reading a PDF, the system instantly surfaces related sections from their entire document library, enabling seamless knowledge discovery and connection-building across multiple documents.

## 🚀 **Quick Start**

### **Build & Run**
```bash
# Build the Docker image
docker build --platform linux/amd64 -t adobe-hackathon .

# Run with environment variables (example)
docker run -v /path/to/credentials:/credentials \
  -e ADOBE_EMBED_API_KEY=your_adobe_key \
  -e LLM_PROVIDER=gemini \
  -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json \
  -e GEMINI_MODEL=gemini-2.5-flash \
  -e TTS_PROVIDER=azure \
  -e AZURE_TTS_KEY=your_tts_key \
  -e AZURE_TTS_ENDPOINT=your_tts_endpoint \
  -p 8080:8080 adobe-hackathon
```

### **Access the Application**
- Open `http://localhost:8080` in your browser
- Upload your document library and select a current document to read
- Start selecting text to discover related content!

## ✨ **Core Features**

### **1. Intelligent Upload Flow**
- **Library Upload**: Bulk upload of past documents (your knowledge base)
- **Current Document**: Select the PDF you want to read with AI assistance
- **Smart Processing**: Automatic document analysis and cross-referencing

### **2. Real-Time Text Selection Search**
- **Instant Discovery**: Select any text → get related sections in <1 second
- **Cross-Document Linking**: Find connections across your entire document library
- **Smart Snippets**: 2-4 sentence extracts with relevance scoring
- **One-Click Navigation**: Jump directly to source documents and pages

### **3. AI-Powered Insights** (+5 Bonus Points)
- **Key Takeaways**: Most important insights relevant to your role
- **Did You Know**: Surprising facts and discoveries
- **Contradictions**: Conflicting viewpoints across documents
- **Cross-Document Connections**: How documents relate to each other
- **Executive Summary**: Personalized based on your job-to-be-done

### **4. Audio Overview/Podcast Mode** (+5 Bonus Points)
- **2-5 Minute Audio**: Natural-sounding audio summaries
- **Multi-Speaker Support**: Conversational podcast format
- **Context-Aware**: Based on selected text and related sections
- **Grounded Content**: Uses only your uploaded documents

### **5. Interactive Chat Interface**
- **Document Q&A**: Ask questions about your documents
- **Context-Aware**: Understands your role and objectives
- **Source Attribution**: Answers grounded in your documents

## 🏗️ **Technical Architecture**

### **Backend (Bun + Hono)**
- **Fast API Server**: Bun runtime for optimal performance
- **Real-Time Search**: Sub-second semantic similarity matching
- **Multi-Provider AI**: Supports Gemini, OpenAI, Ollama (LLM) and Azure, GCP, local (TTS)
- **Caching Strategy**: SQLite embeddings cache + FAISS library index

### **Frontend (React + Vite)**
- **Modern UI**: Tailwind CSS with responsive design
- **PDF Viewing**: Adobe PDF Embed API with PDF.js fallback
- **Real-Time Updates**: React Query for efficient data fetching
- **Text Selection**: Advanced selection detection and overlay UI

### **AI Pipeline (Python)**
- **Semantic Search**: `paraphrase-distilroberta-base-v2` sentence transformer
- **Document Processing**: PyMuPDF for outline extraction and text analysis
- **Smart Ranking**: Multi-factor scoring (semantic similarity + document structure + actionability)
- **Cross-Document Library**: FAISS vector database for fast similarity search

## 🎪 **Demo Workflow**

1. **Upload Library**: Add multiple PDFs representing your past documents
2. **Select Current Doc**: Choose the PDF you want to read
3. **Start Reading**: Open the document in the high-fidelity PDF viewer
4. **Select Text**: Highlight any interesting passage or concept
5. **Discover Connections**: Instantly see related sections from other documents
6. **Navigate**: Click snippets to jump to source pages
7. **Get Insights**: View AI-generated takeaways and contradictions
8. **Listen**: Generate audio podcast about the selected topic
9. **Chat**: Ask questions about the content

## 🛠️ **Environment Variables**

### **Required**
- `ADOBE_EMBED_API_KEY`: Your Adobe PDF Embed API key (optional, uses PDF.js fallback)

### **Optional AI Providers**
```bash
# Gemini (Recommended for evaluation)
LLM_PROVIDER=gemini
GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json
GEMINI_MODEL=gemini-2.5-flash

# Azure TTS (Recommended for evaluation)
TTS_PROVIDER=azure
AZURE_TTS_KEY=your_key
AZURE_TTS_ENDPOINT=your_endpoint

# Local alternatives
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3
TTS_PROVIDER=local
```

## 📊 **Performance Characteristics**

- **Text Selection Response**: <1 second for real-time user engagement
- **Document Processing**: ~10-30 seconds for 50-page PDFs
- **Memory Footprint**: <2GB total (including models and cache)
- **Docker Image Size**: <15GB (well under 20GB requirement)
- **Concurrent Users**: Supports multiple users with shared cache

## 🎨 **UX Highlights**

- **Speed**: Minimal delay between text selection and results
- **Relevance**: High-accuracy semantic matching with similarity scores
- **Engagement**: Natural audio generation and conversational UI
- **Extensibility**: Modular architecture supports additional features
- **Accessibility**: Keyboard navigation and screen reader support

## 📁 **Project Structure**

```
├── Dockerfile                 # Single container deployment
├── server/                    # Bun + Hono API server
│   ├── src/index.ts          # Main server with static file serving
│   ├── src/llm.ts            # AI integration (Gemini/OpenAI/Ollama)
│   └── src/sample_scripts/   # Python integration scripts
├── frontend/                  # React + Vite UI
│   ├── src/components/       # UI components
│   ├── src/pages/           # Route components
│   └── src/services/        # API integration
├── 1b/                       # Python AI pipeline
│   ├── src/main.py          # Document processing
│   ├── src/ranker.py        # Semantic ranking
│   ├── src/text_search.py   # Real-time search
│   └── cache/               # Embeddings and library index
└── 1a/                       # PDF outline extractor (legacy)
```

## 🏆 **Competitive Advantages**

1. **Real-Time Discovery**: Instant cross-document connections during reading
2. **Semantic Intelligence**: Goes beyond keyword matching to understand context
3. **Multi-Modal Experience**: Text, audio, and interactive chat
4. **Production Ready**: Optimized Docker deployment with health checks
5. **Extensible Architecture**: Easy to add new AI providers and features

## 🔧 **Development Notes**

- **Graceful Degradation**: Works without external APIs using local alternatives
- **Error Handling**: Comprehensive fallbacks and user-friendly error messages
- **Caching**: Aggressive caching for embeddings and search results
- **Security**: No hardcoded credentials, environment variable configuration
- **Monitoring**: Health checks and structured logging

---

**Built for Adobe India Hackathon 2025 - Grand Finale**  
*"From Brains to Experience – Make It Real"*
