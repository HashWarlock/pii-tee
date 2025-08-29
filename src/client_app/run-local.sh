#!/bin/bash

# Run the Next.js app locally for testing

echo "Starting PII-TEE Frontend..."
echo "================================"
echo ""
echo "Make sure the API is running at http://localhost:8080"
echo ""

# Set environment variables
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-"http://localhost:8080"}
export NODE_ENV=development
export PORT=3000

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo ""
echo "Starting Next.js development server..."
echo "The app will be available at http://localhost:3000"
echo ""
echo "Main page: http://localhost:3000"
echo "Chat interface: http://localhost:3000/chat"
echo ""

# Run the development server
npm run dev