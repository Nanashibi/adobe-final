#!/bin/bash

echo "🚀 Starting Adobe Hackathon Finale System..."

# Activate Python virtual environment (if any)
export PATH="/app/venv/bin:$PATH"

# Create necessary directories if they don't exist
mkdir -p /app/1b/input /app/1b/output /app/1b/cache /var/log/supervisor

# Set proper permissions
chmod -R 755 /app/1b/input /app/1b/output /app/1b/cache
chmod -R 755 /var/log/supervisor

# Ensure nginx configuration is valid
echo "🔍 Validating nginx configuration..."
nginx -t

# Start frontend dev server in background
echo "🌐 Starting frontend dev server on port 8080..."
cd /app/frontend
bun run dev --host 0.0.0.0 --port 8080 &

# Start supervisord (handles backend + nginx)
echo "📋 Starting supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf