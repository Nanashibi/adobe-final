#!/bin/bash

echo "🚀 Starting Adobe Hackathon Finale System..."

# Activate Python virtual environment
export PATH="/app/venv/bin:$PATH"

# Create necessary directories if they don't exist
mkdir -p /app/1b/input /app/1b/output /app/1b/cache

# Set proper permissions
chmod -R 755 /app/1b/input /app/1b/output /app/1b/cache

# Start supervisord
echo "📋 Starting supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
