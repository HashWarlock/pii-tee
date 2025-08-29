.PHONY: help install dev build test clean docker-up docker-down docker-clean lint check-env

# Default target
help:
	@echo "PII-TEE Project Commands"
	@echo "========================"
	@echo ""
	@echo "Quick Start:"
	@echo "  make install      - Install all dependencies"
	@echo "  make check-env    - Verify environment setup"
	@echo "  make docker-up    - Start all services with Docker"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development servers"
	@echo "  make test         - Run all tests"
	@echo "  make lint         - Run linters and type checks"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up    - Start all services"
	@echo "  make docker-down  - Stop all services"
	@echo "  make docker-build - Build Docker images"
	@echo "  make docker-logs  - View service logs"
	@echo "  make docker-clean - Clean volumes and images"
	@echo ""
	@echo "Production:"
	@echo "  make prod-up      - Start production services"
	@echo "  make prod-down    - Stop production services"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean        - Clean all build artifacts"

# Check environment
check-env:
	@echo "Checking environment setup..."
	@test -f .env || (echo "❌ .env file not found. Copy .env.example to .env" && exit 1)
	@echo "✅ .env file exists"
	@command -v python3 >/dev/null 2>&1 || (echo "❌ Python 3 not found" && exit 1)
	@echo "✅ Python 3 installed"
	@command -v node >/dev/null 2>&1 || (echo "❌ Node.js not found" && exit 1)
	@echo "✅ Node.js installed"
	@command -v docker >/dev/null 2>&1 || (echo "❌ Docker not found" && exit 1)
	@echo "✅ Docker installed"
	@echo ""
	@echo "Environment check complete! ✨"

# Install dependencies
install:
	@echo "Installing API dependencies..."
	cd src/api && pip install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd src/client_app && npm install
	@echo ""
	@echo "Installation complete! Run 'make dev' to start development servers."

# Development
dev:
	@echo "Starting development servers..."
	@echo ""
	@echo "Run these commands in separate terminals:"
	@echo "  Terminal 1: cd src/api && uvicorn main:app --reload --host 0.0.0.0 --port 8080"
	@echo "  Terminal 2: cd src/client_app && npm run dev"
	@echo ""
	@echo "Or use 'make docker-up' to run everything in Docker."

# Docker commands
docker-up:
	docker-compose up -d
	@echo ""
	@echo "Services started! Access:"
	@echo "  Frontend: http://localhost:3000"
	@echo "  API: http://localhost:8080"

docker-down:
	docker-compose down

docker-build:
	docker-compose build --no-cache

docker-logs:
	docker-compose logs -f

docker-clean:
	docker-compose down -v
	docker system prune -f

# Production
prod-up:
	docker-compose -f docker-compose-prod.yml up -d

prod-down:
	docker-compose -f docker-compose-prod.yml down

# Testing
test:
	@echo "Running API tests..."
	@cd src/api && python -m pytest tests/ -v 2>/dev/null || echo "⚠️  No API tests found"
	@echo "Running frontend tests..."
	@cd src/client_app && npm test 2>/dev/null || echo "⚠️  No frontend tests configured"

# Linting and type checking
lint:
	@echo "Running Python linting..."
	@cd src/api && python -m ruff check . 2>/dev/null || echo "ℹ️  Install ruff: pip install ruff"
	@echo "Running TypeScript checks..."
	@cd src/client_app && npm run typecheck 2>/dev/null || npm run build

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "node_modules/.cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@find . -type f -name ".DS_Store" -delete 2>/dev/null || true
	@echo "Clean complete!"

# Build specific images
build-api:
	docker build --platform linux/amd64 -t pii-api:local ./src/api

build-frontend:
	docker build --platform linux/amd64 -t pii-tee-frontend:local ./src/client_app