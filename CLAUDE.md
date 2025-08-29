# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a PII (Personally Identifiable Information) anonymization service that uses Trusted Execution Environment (TEE) technology. The system consists of:
- **API Service**: FastAPI-based service for text anonymization/deanonymization using Presidio
- **Frontend Application**: Modern Next.js web application with responsive design and real-time chat
- **Legacy Client**: Terminal and web-based Python demo client (deprecated)
- **Redis**: State management for maintaining anonymization mappings across sessions

## Quick Start with Docker (Recommended)

```bash
# 1. Clone and configure
git clone <repository-url> && cd pii-tee
cp .env.example .env
# Edit .env with your REDIS_PASSWORD

# 2. Start all services
docker-compose up -d

# 3. Access applications
# Frontend: http://localhost:3000
# API: http://localhost:8080
```

See [DOCKER.md](docs/DOCKER.md) for detailed Docker setup instructions.

## Development Commands

### API Service (src/api/)
```bash
# Install dependencies
cd src/api
pip install -r requirements.txt

# Run locally
uvicorn main:app --host 0.0.0.0 --port 8080

# Build and run Docker container
docker build -t api .
docker run -d -p 8080:80 --env-file .env api
```

### Frontend Application (src/client_app/)
```bash
# Install dependencies
cd src/client_app
npm install

# Development server
npm run dev

# Production build
npm run build
npm start

# Docker build and run (linux/amd64 platform)
docker build --platform linux/amd64 -t pii-tee-frontend .
docker run -p 3000:3000 pii-tee-frontend
```

### Legacy Python Client (deprecated)
```bash
# Install dependencies
cd src/client_app
pip install -r requirements.txt

# Terminal chat with LLM
python client.py

# Web interface  
python serve.py
```

### Docker Compose
```bash
# Run all services
docker-compose up -d

# Production deployment
docker-compose -f docker-compose-prod.yml up -d
```

## Architecture

### Service Layer Design
The application follows a layered service architecture with clear separation of concerns:

1. **API Layer** (`main.py`): FastAPI endpoints that handle HTTP requests/responses
   - `/anonymize`: Accepts text and returns anonymized version with session tracking
   - `/deanonymize`: Reverses anonymization using session state
   - `/public-key`: Returns public key for signature verification
   - `/verify-signature`: Verifies content signatures

2. **Toolkit Service** (`services/toolkit_service.py`): Orchestration layer that:
   - Coordinates between Presidio (anonymization) and State services
   - Manages session lifecycle and entity mappings
   - Generates quotes and signatures via QuoteService for TEE attestation

3. **Presidio Services** (multiple implementations available):
   - `PythonPresidioService`: Direct Python integration with Presidio
   - `HttpPresidioService`: HTTP client for external Presidio service
   - `HybridPresidioService`: Combined approach
   - Uses instance counter pattern for consistent anonymization within sessions

4. **State Management**:
   - `RedisStateService`: Production state storage using Redis
   - `InMemoryStateService`: Alternative for development/testing
   - Maintains entity mappings per session for bidirectional anonymization

5. **Quote Service** (`services/quote/quote_service.py`):
   - Integrates with dstack SDK for TEE attestation
   - Generates Intel SGX quotes and signatures
   - Provides cryptographic proof of computation integrity

### Anonymization Strategy
- Uses Presidio analyzer to detect PII entities (names, locations, phone numbers, etc.)
- Implements instance counting: same entities get consistent replacements within a session
- Maintains reversible mappings for deanonymization
- Language-aware processing (defaults to English)

### Session Management
- Sessions identified by UUID
- Entity mappings stored in Redis with configurable TTL
- Stateless API design with external state persistence

## Important Notes

- Always ensure `.env` files are configured before running services
- Redis password must be set via `REDIS_PASSWORD` environment variable
- API URL in client container must not use localhost (use service names in Docker)
- The `/var/run/dstack.sock` volume mount is required for TEE functionality
- Session data persists in Redis named volume for production deployments

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
