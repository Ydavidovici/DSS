#!/usr/bin/env bash

set -e

echo "📦 Pulling latest changes from Git..."
git pull

echo "🚀 Building and starting Docker containers..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "✅ Deployment successful!"