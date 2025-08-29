# PII-TEE: Privacy-Preserving Text Anonymization with TEE

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-green.svg)](https://hub.docker.com/)
[![TEE](https://img.shields.io/badge/TEE-enabled-purple.svg)](docs/tee/)

A secure, privacy-preserving text anonymization service that leverages Trusted Execution Environment (TEE) technology to protect sensitive data. Built with Intel SGX/TDX support through Phala Network's dstack SDK.

## 🚀 Quick Start

Get up and running in under 5 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/HashWarlock/pii-tee.git && cd pii-tee

# 2. Configure environment
cp .env.example .env
# Edit .env - set REDIS_PASSWORD

# 3. Start with Docker
docker-compose up -d

# 4. Access the application
open http://localhost:3000
```

That's it! The application is now running with:
- 🌐 **Frontend**: http://localhost:3000
- 🔧 **API**: http://localhost:8080
- 📊 **Health Check**: http://localhost:8080/health

## 🎯 Features

- **🔒 Privacy-First**: Anonymize PII (names, emails, locations) while maintaining text coherence
- **🔐 TEE Attestation**: Cryptographic proof of secure computation with Intel SGX/TDX
- **↔️ Reversible**: Bidirectional anonymization with session-based mappings
- **⚡ Real-time**: Stream-based processing for interactive applications
- **🎨 Modern UI**: Responsive Next.js interface with real-time updates
- **🔑 Secure**: Ed25519/ECDSA signatures for data integrity verification

## 📁 Project Structure

```
pii-tee/
├── src/
│   ├── api/              # FastAPI backend service
│   │   ├── main.py       # API endpoints
│   │   └── services/     # Core services (Presidio, TEE, State)
│   └── client_app/       # Next.js frontend
│       ├── src/app/      # App router pages
│       └── src/components/ # React components
├── docs/                 # Documentation
├── scripts/              # Utility scripts
├── docker-compose.yml    # Docker orchestration
└── .env.example         # Environment template
```

## 🛠️ Technology Stack

- **Backend**: FastAPI (Python 3.11+) with Presidio for PII detection
- **Frontend**: Next.js 15 with TypeScript, React 19, shadcn/ui
- **TEE**: Phala Network dstack SDK for Intel SGX/TDX
- **State**: Redis for session management
- **Container**: Docker & Docker Compose

## 📖 Documentation

### 🎯 Quick Links

| Essential Guides | Description |
|-----------------|-------------|
| **[Getting Started](docs/GETTING_STARTED.md)** | Complete setup guide with prerequisites and quick start |
| **[Architecture](docs/ARCHITECTURE.md)** | System design, components, and data flow |
| **[API Reference](docs/API.md)** | Complete API documentation with examples |
| **[Deployment](docs/DEPLOYMENT.md)** | Production deployment for Docker, K8s, and cloud |

### 🛠️ Development & Testing

| Guide | Description |
|-------|-------------|
| [Docker Setup](docs/DOCKER.md) | Detailed Docker configuration and commands |
| [Testing Guide](docs/TESTING.md) | Unit, integration, and E2E testing strategies |
| [TEE Simulator](docs/tee-simulator-testing.md) | Test TEE features without hardware |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Solutions for common issues |

### ❓ Help & Reference

| Resource | Description |
|----------|-------------|
| [FAQ](docs/FAQ.md) | Frequently asked questions |
| [Signature Verification](docs/signature-verification-update.md) | Cryptographic signing details |
| [Configuration](docs/CONFIGURATION.md) | Environment variable reference |

## 🔧 Development

### Local Development

```bash
# Backend
cd src/api
pip install -r requirements.txt
uvicorn main:app --reload --port 8080

# Frontend
cd src/client_app
npm install
npm run dev
```

### Testing

```bash
# Run all tests
make test

# Test signature verification
./scripts/test/test-signature-verification.sh

# Test with TEE simulator
./scripts/setup_tee_simulator.sh start
```

### Building

```bash
# Build Docker images
docker-compose build

# Build for production
docker-compose -f docker-compose-prod.yml build
```

## 🚢 Deployment

### Docker Compose (Recommended)

```bash
# Production deployment
docker-compose -f docker-compose-prod.yml up -d
```

### Phala Cloud

See [Phala Cloud Deployment Guide](docs/deployment/phala-cloud.md) for TEE-enabled deployment.

### Environment Variables

Key configuration (see [full list](docs/CONFIGURATION.md)):

| Variable | Description | Required |
|----------|-------------|----------|
| `REDIS_PASSWORD` | Redis authentication | ✅ |
| `API_PORT` | API service port (default: 8080) | ❌ |
| `CLIENT_PORT` | Frontend port (default: 3000) | ❌ |
| `NODE_ENV` | Environment (development/production) | ❌ |

## 🔐 Security

- All PII processing occurs within TEE enclaves
- Session data encrypted at rest in Redis
- Signatures verify data integrity
- No PII logged or persisted beyond session TTL

See [Security Guide](docs/SECURITY.md) for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for:
- Code of conduct
- Development workflow
- Pull request process
- Coding standards

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Presidio](https://github.com/microsoft/presidio) for PII detection
- [Phala Network](https://phala.network) for TEE infrastructure
- [dstack SDK](https://github.com/Dstack-TEE/dstack) for SGX/TDX integration

## 📧 Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/HashWarlock/pii-tee/issues)
- 💬 [Discussions](https://github.com/HashWarlock/pii-tee/discussions)

---

Built with ❤️ for privacy-preserving applications