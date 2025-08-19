# Adobe Hackathon Finale - Docker Setup

## 🚀 Quick Start

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

### Optional
- `ADOBE_EMBED_API_KEY=<your_key>` (for Adobe PDF Embed API)

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
