
# Single container for Adobe Hackathon Finale
FROM --platform=linux/amd64 python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production
ENV PORT=8080

# Set default values for Adobe environment variables (will be overridden at runtime)
ENV ADOBE_EMBED_API_KEY=""
ENV LLM_PROVIDER=gemini
ENV GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json
ENV GEMINI_MODEL=gemini-2.5-flash
ENV TTS_PROVIDER=azure
ENV AZURE_TTS_KEY=""
ENV AZURE_TTS_ENDPOINT=""

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    libffi-dev \
    libssl-dev \
    libjpeg-dev \
    libpng-dev \
    libfreetype6-dev \
    libwebp-dev \
    supervisor \
    nginx \
    nodejs \
    npm \
    bash \
    unzip \
    # Dependencies for PyMuPDF
    libmupdf-dev \
    # Dependencies for ML libraries
    libopenblas-dev \
    liblapack-dev \
    libgfortran5 \
    # Additional build tools
    cmake \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install Bun via npm
RUN npm install -g bun
ENV PATH="/usr/local/bin:$PATH"

# Create app directory
WORKDIR /app

# Copy Python requirements first for better caching
COPY 1b/requirements.txt ./1b/requirements.txt

# Upgrade pip and install Python dependencies
RUN pip install --upgrade pip setuptools wheel
RUN pip install -r 1b/requirements.txt

# Copy server dependencies
COPY server/package.json ./server/
COPY server/bun.lock ./server/

# Install server dependencies
RUN cd server && bun install --production

# Copy frontend dependencies ONLY
COPY frontend/package.json ./frontend/
COPY frontend/bun.lock ./frontend/

# Install frontend dependencies (with dev deps for building)
RUN cd frontend && bun install

# Copy all code
COPY 1b/ ./1b/
COPY server/ ./server/
COPY frontend/ ./frontend/

# Create necessary directories with proper permissions
RUN mkdir -p /app/1b/input /app/1b/output /app/1b/cache /var/log/supervisor /etc/supervisor/conf.d /credentials /var/log/nginx

# Copy supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Set proper permissions
RUN chown -R www-data:www-data /var/log/nginx /var/log/supervisor
RUN chmod -R 755 /app/1b/input /app/1b/output /app/1b/cache

# Expose port
EXPOSE 8080

# Start supervisor (backend + nginx) and run frontend dev server in background
CMD ["/start.sh"]