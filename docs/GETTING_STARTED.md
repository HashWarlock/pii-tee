# Getting Started with PII-TEE

This guide will walk you through setting up and running PII-TEE, a privacy-preserving text anonymization service with TEE attestation.

## Prerequisites

Before you begin, ensure you have:

- **Docker Desktop** (20.10+) or Docker Engine with Docker Compose
- **Node.js** (18+ LTS) - for local development
- **Python** (3.10+) - for API development
- **Git** - for version control
- **4GB RAM** minimum available
- **Flox** (optional) - for managed development environment

## Quick Start (5 minutes)

The fastest way to get PII-TEE running:

```bash
# 1. Clone the repository
git clone https://github.com/HashWarlock/pii-tee.git
cd pii-tee

# 2. Set up environment
cp .env.example .env
# Edit .env and set REDIS_PASSWORD to a secure value

# 3. Start all services with Docker
docker compose up -d

# 4. Verify everything is running
docker compose ps

# 5. Access the application
open http://localhost:3000
```

That's it! You now have:
- 🌐 **Frontend**: http://localhost:3000 - Interactive chat interface
- 🔧 **API**: http://localhost:8080 - REST API endpoints
- 💾 **Redis**: Running internally for session storage

## Understanding the Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (User)                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Frontend (Next.js - Port 3000)              │
│  - React 19 with TypeScript                              │
│  - Three-panel chat interface                            │
│  - Real-time signature verification                      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│               API (FastAPI - Port 8080)                  │
│  - Text anonymization/deanonymization                    │
│  - TEE attestation & signatures                          │
│  - Session management                                    │
└─────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────┐              ┌─────────────────────┐
│  Redis (6379)    │              │   TEE Environment   │
│  Session Store   │              │  Intel SGX/TDX      │
└──────────────────┘              └─────────────────────┘
```

## Development Setup

### Option 1: Using Flox (Recommended)

Flox provides a managed development environment with all dependencies:

```bash
# Install flox if not already installed
curl -fsSL https://flox.sh/install | sh

# Activate the environment
flox activate

# Dependencies are automatically installed!
# Start developing immediately
```

### Option 2: Manual Setup

#### Backend (API) Setup

```bash
cd src/api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Download language models for PII detection
python -m spacy download en_core_web_lg

# Run the API
uvicorn main:app --reload --port 8080
```

#### Frontend Setup

```bash
cd src/client_app
npm install

# Development server with hot reload
npm run dev

# Production build
npm run build
npm start
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Required
REDIS_PASSWORD=your_secure_password_here

# Optional - Defaults shown
API_PORT=8080
CLIENT_PORT=3000
REDIS_HOST=redis
REDIS_PORT=6379
NODE_ENV=development

# Signing Configuration
SIGNING_METHOD=ecdsa  # or 'ed25519'

# API Keys (if using external models)
OPENAI_API_KEY=sk-...  # Optional
```

### Signing Methods

PII-TEE supports two cryptographic signing methods:

1. **ECDSA** (default) - Ethereum-compatible signatures
   - Public key: Ethereum address (0x...)
   - Used for Web3 compatibility

2. **Ed25519** - High-performance signatures
   - Public key: Base64-encoded
   - Faster verification

## Testing Your Setup

### 1. Test the API

```bash
# Test anonymization
curl -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d '{"text": "John Doe lives at john@example.com"}'

# Expected response:
{
  "session_id": "uuid-here",
  "text": "<PERSON_0> lives at <EMAIL_ADDRESS_0>",
  "signature": "0x...",
  "public_key": "0x...",
  "signing_method": "ecdsa"
}
```

### 2. Test Signature Verification

```bash
# Run the comprehensive test suite
./scripts/test/test-signature-verification.sh
```

### 3. Test the Frontend

1. Open http://localhost:3000
2. Type a message with PII (names, emails, phone numbers)
3. Watch it get anonymized in the middle panel
4. See signature verification in the right panel
5. Click expand buttons to see full cryptographic details

## Common Development Tasks

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f pii-api
docker compose logs -f pii-frontend
```

### Restarting Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart pii-api
```

### Rebuilding After Code Changes

```bash
# Rebuild and restart
docker compose build
docker compose up -d

# Or for a specific service
docker compose build pii-api
docker compose up -d pii-api
```

### Cleaning Up

```bash
# Stop all services
docker compose down

# Stop and remove volumes (warning: deletes data)
docker compose down -v

# Remove all containers and images
docker compose down --rmi all
```

## Project Structure

```
pii-tee/
├── src/
│   ├── api/                 # FastAPI backend
│   │   ├── main.py          # API endpoints
│   │   └── services/        # Core services
│   │       ├── presidio/    # PII detection
│   │       ├── quote/       # TEE & signatures
│   │       └── state/       # Session management
│   └── client_app/          # Next.js frontend
│       ├── src/
│       │   ├── app/         # App router pages
│       │   ├── components/  # React components
│       │   └── hooks/       # Custom React hooks
│       └── public/          # Static assets
├── docs/                    # Documentation
├── scripts/                 # Utility scripts
│   └── test/               # Test scripts
├── docker-compose.yml       # Docker orchestration
├── .env.example            # Environment template
└── README.md               # Project overview
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different ports
CLIENT_PORT=3001 API_PORT=8081 docker compose up
```

### Docker Build Fails

```bash
# Clear Docker cache
docker system prune -a

# Rebuild with no cache
docker compose build --no-cache
```

### API Connection Issues

1. Check API is running: `docker compose ps`
2. Verify API URL in frontend: Check browser console
3. Test API directly: `curl http://localhost:8080/anonymize`

### Redis Connection Failed

```bash
# Verify Redis is running
docker compose ps redis

# Check Redis logs
docker compose logs redis

# Test Redis connection
docker compose exec redis redis-cli ping
```

## Next Steps

- 📖 [Architecture Overview](./ARCHITECTURE.md) - Deep dive into system design
- 🧪 [Testing Guide](./TESTING.md) - Comprehensive testing strategies
- 🔒 [TEE Simulator Setup](./tee-simulator-testing.md) - Test TEE features locally
- 🚀 [Deployment Guide](./DEPLOYMENT.md) - Deploy to production
- 🌐 [API Reference](./API.md) - Complete API documentation

## Getting Help

- Check [Troubleshooting Guide](./TROUBLESHOOTING.md) for common issues
- Review [FAQ](./FAQ.md) for frequently asked questions
- Open an issue on [GitHub](https://github.com/HashWarlock/pii-tee/issues)

---

Ready to start developing? Head to the [Architecture Overview](./ARCHITECTURE.md) to understand how everything works together.