# Configuration Guide

## Overview

This guide covers all configuration options for PII-TEE services.

## Environment Variables

### Core Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_PASSWORD` | Password for Redis authentication | - | ✅ |
| `REDIS_HOST` | Redis server hostname | `redis` | ❌ |
| `REDIS_PORT` | Redis server port | `6379` | ❌ |
| `REDIS_DB` | Redis database number | `0` | ❌ |
| `REDIS_TTL` | Session TTL in seconds | `3600` | ❌ |

### API Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `API_PORT` | Port for API service | `8080` | ❌ |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARNING, ERROR) | `INFO` | ❌ |
| `WORKERS` | Number of API workers | `4` | ❌ |
| `SIGNING_METHOD` | Signature method (ecdsa, ed25519) | `ecdsa` | ❌ |

### Frontend Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CLIENT_PORT` | Frontend server port | `3000` | ❌ |
| `NODE_ENV` | Node environment (development, production) | `development` | ❌ |
| `NEXT_PUBLIC_API_URL` | API endpoint URL | `http://localhost:8080` | ❌ |

### TEE Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TEE_MODE` | TEE mode (development, production) | `development` | ❌ |
| `TEE_SOCKET` | Path to TEE socket | `/var/run/tappd.sock` | ❌ |
| `TEE_ATTESTATION_ENDPOINT` | Attestation service URL | - | ❌ |

### Security Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CORS_ORIGINS` | Allowed CORS origins | `*` | ❌ |
| `API_KEY_HEADER` | Header name for API key | `X-API-Key` | ❌ |
| `RATE_LIMIT_PER_MINUTE` | Rate limit per IP | `100` | ❌ |
| `JWT_SECRET` | JWT signing secret | - | ❌ |

## Configuration Files

### Docker Environment (.env)

```env
# Required
REDIS_PASSWORD=your-secure-password-here

# Optional - API
API_PORT=8080
LOG_LEVEL=INFO
SIGNING_METHOD=ecdsa

# Optional - Frontend
CLIENT_PORT=3000
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Optional - Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_TTL=3600

# Optional - TEE
TEE_MODE=production
```

### Docker Compose Override

Create `docker-compose.override.yml` for local development:

```yaml
version: '3.8'

services:
  pii-api:
    environment:
      - LOG_LEVEL=DEBUG
      - WORKERS=2
    volumes:
      - ./src/api:/app
    ports:
      - "8080:80"

  client-app:
    environment:
      - NODE_ENV=development
    volumes:
      - ./src/client_app:/app
      - /app/node_modules
    ports:
      - "3000:3000"
```

### Production Configuration

For production deployments:

```env
# Production .env.prod
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_TTL=7200
LOG_LEVEL=WARNING
WORKERS=8
NODE_ENV=production
SIGNING_METHOD=ecdsa
TEE_MODE=production
CORS_ORIGINS=https://yourdomain.com
RATE_LIMIT_PER_MINUTE=60
```

## Language Support

Configure supported languages for PII detection:

```python
# In API configuration
SUPPORTED_LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "nl", "pl", "ru", "zh", "ja"]
DEFAULT_LANGUAGE = "en"
```

## Monitoring Configuration

### Prometheus Metrics

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'pii-tee'
    static_configs:
      - targets: ['pii-api:9090']
    metrics_path: /metrics
```

### Logging Configuration

```python
# Python logging config
LOGGING_CONFIG = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'default': {
            'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'default',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': '/var/log/pii-tee/api.log',
            'formatter': 'default',
        },
    },
    'root': {
        'level': os.getenv('LOG_LEVEL', 'INFO'),
        'handlers': ['console', 'file'],
    },
}
```

## Performance Tuning

### Redis Optimization

```bash
# Redis configuration for production
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### API Performance

```python
# Gunicorn configuration
workers = int(os.getenv('WORKERS', 4))
worker_class = 'uvicorn.workers.UvicornWorker'
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
timeout = 30
keepalive = 5
```

## Secret Management

### Using Docker Secrets

```yaml
# docker-compose with secrets
version: '3.8'

secrets:
  redis_password:
    file: ./secrets/redis_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt

services:
  pii-api:
    secrets:
      - redis_password
      - jwt_secret
    environment:
      - REDIS_PASSWORD_FILE=/run/secrets/redis_password
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
```

### Environment Variable Priority

1. Command-line arguments (highest priority)
2. Environment variables
3. `.env` file
4. Default values (lowest priority)

## Validation

Check configuration validity:

```bash
# Validate environment
./scripts/validate-config.sh

# Test configuration
docker-compose config

# Verify services can start
docker-compose up --dry-run
```

## Troubleshooting

Common configuration issues:

1. **Redis connection failed**: Check `REDIS_HOST` and `REDIS_PASSWORD`
2. **CORS errors**: Update `CORS_ORIGINS` with your domain
3. **TEE not available**: Verify `TEE_SOCKET` path exists
4. **High memory usage**: Adjust `REDIS_TTL` and `maxmemory`

## Next Steps

- 📖 [Deployment Guide](./DEPLOYMENT.md) - Deploy with configuration
- 🔒 [Security Guide](./SECURITY.md) - Security configuration
- 🧪 [Testing Guide](./TESTING.md) - Test configuration
- 🔧 [Troubleshooting](./TROUBLESHOOTING.md) - Fix configuration issues