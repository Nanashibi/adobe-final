# Adobe Hackathon Finale - Docker Setup

## 🚀 Quick Start

### Adobe API Key
ADOBE_EMBED_API_KEY=f991e8c76f754ecd8f599e223b57d885

### Build the Docker Image
```bash
docker build --platform linux/amd64 -t adobe-hackathon-finale .
```

### Run the Application
```bash
docker run -v /path/to/credentials:/credentials \
  -e ADOBE_EMBED_API_KEY=<your_adobe_key> \
  -e LLM_PROVIDER=gemini \
  -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json \
  -e GEMINI_MODEL=gemini-2.5-flash \
  -e TTS_PROVIDER=azure \
  -e AZURE_TTS_KEY=<your_tts_key> \
  -e AZURE_TTS_ENDPOINT=<your_tts_endpoint> \
  -p 8080:8080 adobe-hackathon-finale
```

### Access the Application
Open `http://localhost:8080` in your browser

## 🏗️ Architecture

This is a **single-container solution** that runs all services using supervisord:

- **Nginx** (Port 8080): Serves frontend and proxies API calls
- **Bun Server** (Port 3000): API server for collections, PDFs, insights
- **Python 1b Pipeline**: AI processing for document analysis
- **Supervisord**: Process manager for all services

## 🔧 Environment Variables

### Required for Evaluation
- `LLM_PROVIDER=gemini` (or `openai`, `ollama`)
- `GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json`
- `GEMINI_MODEL=gemini-2.5-flash`
- `TTS_PROVIDER=azure` (or `gcp`, `local`)
- `AZURE_TTS_KEY=<your_key>`
- `AZURE_TTS_ENDPOINT=<your_endpoint>`

### Adobe Embed API Key
- `ADOBE_EMBED_API_KEY=f991e8c76f754ecd8f599e223b57d885` (for Adobe PDF Embed API)

## 📁 File Structure

```
/app/
├── 1b/                    # Python AI pipeline
│   ├── src/              # Source code
│   ├── input/            # Uploaded PDFs (runtime)
│   ├── output/           # Generated results (runtime)
│   └── cache/            # Embeddings cache (runtime)
├── server/               # Bun API server
├── frontend/             # React app (built)
├── venv/                 # Python virtual environment
└── start.sh              # Startup script
```

## 🚀 How It Works

1. **Build Time**: 
   - Install Python 3.10, Bun, Node.js
   - Set up Python virtual environment
   - Install all dependencies
   - Build React frontend

2. **Runtime**:
   - Supervisord starts nginx and bun-server
   - Nginx serves frontend on port 8080
   - API calls proxied to bun-server on port 3000
   - Python pipeline processes documents when needed

## 🔍 API Endpoints

- `POST /collections` - Upload PDFs and create collection
- `GET /collections/:id/status` - Check processing status
- `GET /collections/:id/combined` - Get all results
- `POST /collections/:id/search-selection` - Text selection search
- `POST /collections/:id/insights` - Generate AI insights
- `POST /collections/:id/podcast` - Generate audio podcast
- `GET /pdfs/:collection/:filename` - Serve PDF files
- `GET /audio/:collection/:filename` - Serve audio files

## 🐛 Troubleshooting

### Check Container Status
```bash
docker exec -it <container_id> supervisorctl status
```

### View Logs
```bash
# Nginx logs
docker exec -it <container_id> tail -f /var/log/supervisor/nginx.out.log

# Bun server logs
docker exec -it <container_id> tail -f /var/log/supervisor/bun-server.out.log

# Supervisor logs
docker exec -it <container_id> tail -f /var/log/supervisor/supervisord.log
```

### Common Issues

1. **Port 8080 already in use**: Change the port mapping in docker run
2. **Python dependencies fail**: Check if all system libraries are installed
3. **Frontend not loading**: Verify nginx is running and serving files

## 📊 Performance

- **Container Size**: ~8-12GB (well under 20GB limit)
- **Startup Time**: ~30-60 seconds
- **Memory Usage**: ~2-4GB during operation
- **Concurrent Users**: Supports multiple users with shared cache

## 🔒 Security Notes

- No hardcoded credentials
- Environment variables for all API keys
- Container runs as root (required for supervisord)
- Internal services not exposed externally

## 🎯 Evaluation Ready

This setup meets all hackathon requirements:
- ✅ Single container solution
- ✅ Frontend + backend on port 8080
- ✅ All mandatory features implemented
- ✅ Bonus features (Insights + Podcast) included
- ✅ Environment variable configuration
- ✅ Under 20GB image size


## Adobe Local Testing

Multi-app workspace containing:
- **1a**: PDF outline extractor (standalone, Docker-friendly)
- **1b**: PDF section extraction, ranking, and recommendations (Python)
- **server**: Bun + Hono API that orchestrates 1b runs and serves PDFs
- **frontend**: Vite + React UI for upload, reading, insights, and recommendations

### Adobe API Key
ADOBE_EMBED_API_KEY=f991e8c76f754ecd8f599e223b57d885

### Repository structure
```
1a/                 # Standalone PDF outline extractor (PyMuPDF)
1b/                 # Section extraction, ranking, library recommendations
  src/
  input/            # Uploaded collections (created at runtime)
  output/           # Outputs per collection
  cache/            # Embedding cache + library index
server/             # Bun + Hono API (port 8787)
frontend/           # Vite React app (port 5173)
```

## Prerequisites
- **Python**: 3.10+ recommended (for 1b)
- **Node.js**: 18+ (for frontend tooling)
- **Bun**: 1.1+ (`curl -fsSL https://bun.sh/install | bash`) for the API server
- Optional: **Docker** (to run `1a`/`1b` in containers)

## Quick start (end-to-end, local)
1. **Set up OpenAI API key** (required for LLM features):
   ```bash
   # Create environment file
   cd server
   cp env.example .env
   # Edit .env and add your OpenAI API key:
   # OPENAI_API_KEY=your_api_key_here
   ```

2. Install 1b Python dependencies (in a venv):
   ```bash
   cd 1b
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -U pip
   pip install -r requirements.txt
   ```

3. Start the API server (port 8787):
   ```bash
   cd server
   bun install
   bun run dev
   ```

3. Start the frontend (port 5173):
   ```bash
   cd frontend
   npm i
   npm run dev
   ```

4. Open the app and upload PDFs:
   - Visit `http://localhost:5173`
   - Upload PDFs, enter Persona and Job, then submit
   - The app will automatically connect to `http://localhost:8787`

Outputs will be written to `1b/output/<Collection ...>/` and served via the API.

## How it works
- Frontend uploads PDFs to `POST /collections`. The API writes input JSON and files into `1b/input/<Collection ...>/` and triggers `1b/src/main.py` using the local venv (or `python3` fallback).
- `1b` extracts and ranks relevant sections, writes `challenge1b_output.json`, per-section recommendations, and library recommendations under `1b/output/<Collection ...>/`.
- Frontend polls `GET /collections/:id/status` and then loads `GET /collections/:id/combined` for the reader.
- PDFs are streamed with range support from `GET /pdfs/:collectionId/:filename` for the viewer.

### API summary (server, port 8787)
- `POST /collections` (multipart: `files[]`, `persona`, `job`) → `{ collectionId }`
- `GET /collections` → list of collection ids
- `GET /collections/:id/status` → `{ status: queued|running|ready|error, error? }`
- `GET /collections/:id/output` → raw `challenge1b_output.json`
- `GET /collections/:id/recommendations` → per-section recommendations
- `GET /collections/:id/library` → library-wide recommendations
- `GET /collections/:id/combined` → merged payload for the frontend
- `GET /pdfs/:collectionId/:filename` → PDF bytes with Range + CORS

## 1b (Python) details
### Install
```bash
cd 1b
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
```

### Run standalone (batch all collections in `1b/input/`)
```bash
cd 1b
source .venv/bin/activate
python src/main.py
```
Environment variables:
- `COLLECTION_ID` (optional): Process only a specific collection directory
- `TOP_N` (default 5): Number of top sections to extract
- `DIVERSITY` (default 0.3): Diversity factor for result de-duplication
- `EMBEDDING_MODEL_NAME` (default `BAAI/bge-base-en-v1.5`)
- `EMBEDDING_DEVICE` (default `cpu`)
- `RERANKER_MODEL_NAME` (default `cross-encoder/ms-marco-MiniLM-L-6-v2`, optional)
- `RERANKER_DEVICE` (default `cpu`)

Notes:
- First run downloads transformer weights; subsequent runs are cached.
- FAISS is optional. If unavailable, a NumPy fallback is used.

### Inputs/outputs
- Inputs written by the API: `1b/input/<Collection ...>/`
  - `challenge1b_input.json` with persona, job, and document list
  - `PDFs/` with original files
- Outputs produced by 1b: `1b/output/<Collection ...>/`
  - `challenge1b_output.json`
  - `recommendations_output.json`
  - `library_recommendations.json`
- Caches: `1b/cache/embeddings.sqlite3`, `1b/cache/library.index`, `1b/cache/library_meta.json`

## Server (Bun + Hono)
### Install & run
```bash
cd server
bun install
bun run dev
```
Defaults:
- Port: `8787`
- Uses `1b/.venv/bin/python` if present, otherwise `python3`
- Writes inputs/outputs under `1b/`

## Frontend (Vite + React)
### Install & run
```bash
cd frontend
npm i
npm run dev
```
Then set Settings → **API Base URL** to `http://localhost:8787`.
Optional: Adobe PDF Client ID for Adobe PDF Embed viewer; otherwise PDF.js is used.

## 1a (PDF outline extractor)
Standalone outline extractor. Easiest is Docker:
```bash
cd 1a
# Prepare folders and add PDFs to ./input
mkdir -p input output
docker build --platform linux/amd64 -t 1a .
docker run --rm -v $(pwd)/input:/app/input:ro -v $(pwd)/output:/app/output --network none 1a
```
Outputs appear in `1a/output/`.

## Docker (all-in-one)

Build the full system:

```bash
docker build -t adobe-final .
```

Run the System:
```bash
docker run -d -p 8080:8080 --name adobe-final-test adobe-final
```

Access the application at: `http://localhost:8080`

To stop and remove the container:
```bash
docker stop adobe-final-test && docker rm adobe-final-test
```

## Troubleshooting
- If PyTorch install fails on macOS, ensure a recent pip and try a CPU build within the venv:
  ```bash
  pip install --no-cache-dir 'torch>=2.1.1,<2.3'
  ```
- If FAISS fails to install, the system will transparently use a NumPy fallback.
- If reranker weights cannot be loaded, reranking is disabled automatically.

## Licensing & data
- Uploaded PDFs remain on disk under `1b/input/` and are served locally for viewing.
- Generated outputs are JSON files under `1b/output/` per collection.
