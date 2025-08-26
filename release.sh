#!/bin/bash
set -e

# Run npm build
echo "Running npm build..."
if npm run build; then
    echo "✅ Build successful, proceeding to Docker build..."
else
    echo "❌ npm build failed, aborting."
    exit 1
fi

# Build Docker image
docker build -t rootifera/gamecubby-web:prod .

# Ask for push
read -p "Push image to Docker Hub? [Y/n]: " answer
answer=${answer:-y}

if [[ "$answer" =~ ^[Yy]$ ]]; then
    docker push rootifera/gamecubby-web:prod
    echo "✅ Docker image pushed."
else
    echo "❌ Skipping push."
fi
