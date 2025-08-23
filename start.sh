#!/bin/bash

echo "🚀 Starting Adobe Hackathon Finale System..."

# Create necessary directories if they don't exist
mkdir -p /app/1b/input /app/1b/output /app/1b/cache /var/log/supervisor

# Set proper permissions
chmod -R 755 /app/1b/input /app/1b/output /app/1b/cache
chmod -R 755 /var/log/supervisor

# Start frontend dev server in background
echo "🌐 Starting frontend dev server on port 5173..."
cd /app/frontend
bun run dev --host 0.0.0.0 --port 5173 &

# Ensure nginx configuration is valid
echo "🔍 Validating nginx configuration..."
nginx -t

# Start supervisord (handles backend + nginx)
echo "📋 Starting supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf