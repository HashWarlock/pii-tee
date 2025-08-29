#!/bin/bash

# Docker Build Test Script for PII-TEE
set -e

echo "🐳 Testing Docker build for PII-TEE Frontend"
echo "============================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is running"

# Navigate to client app directory
cd "$(dirname "$0")/../src/client_app"

echo "📁 Current directory: $(pwd)"
echo "📋 Files in directory:"
ls -la

# Test if required files exist
echo ""
echo "🔍 Checking required files..."

if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found"
    exit 1
fi
echo "✅ Dockerfile exists"

if [ ! -f "package.json" ]; then
    echo "❌ package.json not found"
    exit 1
fi
echo "✅ package.json exists"

if [ ! -f "next.config.ts" ]; then
    echo "❌ next.config.ts not found"
    exit 1
fi
echo "✅ next.config.ts exists"

if [ ! -f ".dockerignore" ]; then
    echo "❌ .dockerignore not found"
    exit 1
fi
echo "✅ .dockerignore exists"

# Test Docker build
echo ""
echo "🔨 Building Docker image for linux/amd64..."
docker build --platform linux/amd64 -t pii-tee-frontend:test .

if [ $? -eq 0 ]; then
    echo "✅ Docker build successful!"
    
    # Test health check endpoint
    echo ""
    echo "🩺 Testing container health..."
    
    # Run container in background
    container_id=$(docker run -d -p 3001:3000 pii-tee-frontend:test)
    echo "🚀 Started container: $container_id"
    
    # Wait for container to start
    echo "⏳ Waiting for container to start..."
    sleep 30
    
    # Test health endpoint
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ Health check passed!"
    else
        echo "❌ Health check failed"
        docker logs $container_id
    fi
    
    # Cleanup
    echo "🧹 Cleaning up..."
    docker stop $container_id > /dev/null 2>&1
    docker rm $container_id > /dev/null 2>&1
    
    # Optional: Remove test image
    # docker rmi pii-tee-frontend:test > /dev/null 2>&1
    
    echo "🎉 Docker build test completed successfully!"
else
    echo "❌ Docker build failed"
    exit 1
fi