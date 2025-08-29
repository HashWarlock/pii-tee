# Deployment Guide

## Overview

This guide covers deploying PII-TEE to various environments, from local Docker to cloud platforms with TEE support.

## Deployment Options

1. **Docker Compose** - Single server deployment
2. **Phala Cloud** - TEE-enabled deployment

## Docker Compose Deployment

### Production Configuration

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - client-app
      - pii-api
    restart: unless-stopped

  client-app:
    image: hashwarlock/pii-tee-frontend:latest
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  pii-api:
    image: hashwarlock/pii-tee-api:latest
    environment:
      - REDIS_HOST=redis
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - SIGNING_METHOD=ecdsa
      - LOG_LEVEL=info
    volumes:
      - /var/run/tappd.sock:/var/run/tappd.sock:ro  # TEE socket
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7.4-alpine
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --save 60 10000
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  redis_data:
    driver: local

networks:
  default:
    name: pii-tee-network
    driver: bridge
```

### Nginx Configuration

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server client-app:3000;
    }

    upstream api {
        server pii-api:80;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=app_limit:10m rate=30r/s;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Frontend
        location / {
            limit_req zone=app_limit burst=20 nodelay;
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API
        location /api/ {
            limit_req zone=api_limit burst=5 nodelay;
            rewrite ^/api/(.*) /$1 break;
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Deployment Steps

```bash
# 1. Prepare production environment
export REDIS_PASSWORD=$(openssl rand -base64 32)
echo "REDIS_PASSWORD=$REDIS_PASSWORD" > .env.prod

# 2. Generate SSL certificates (or use Let's Encrypt)
mkdir ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem

# 3. Build and push Docker images
docker build -t hashwarlock/pii-tee-frontend:latest ./src/client_app
docker build -t hashwarlock/pii-tee-api:latest ./src/api
docker push hashwarlock/pii-tee-frontend:latest
docker push hashwarlock/pii-tee-api:latest

# 4. Deploy
docker compose -f docker-compose.prod.yml up -d

# 5. Verify deployment
docker compose -f docker-compose.prod.yml ps
curl https://yourdomain.com/api/health
```

## Phala Cloud Deployment

Phala Network provides decentralized TEE infrastructure with Intel SGX/TDX support, enabling true privacy-preserving computation.

### Quick Start

```bash
# Install Phala CLI
npm install -g @phala/cli

# Deploy with basic configuration
phala deploy --manifest phala-manifest.yml --stake 10000
```

### Comprehensive Guide

For detailed Phala Cloud deployment instructions including:
- Complete manifest configuration with TEE settings
- Step-by-step deployment process
- Custom domain setup
- Monitoring and maintenance
- Cost optimization strategies
- Migration from other platforms

**See: [Phala Cloud Deployment Guide](./deployment/phala-cloud.md)**

## Environment Variables

### Production Settings

```env
# API Configuration
API_PORT=80
LOG_LEVEL=info
WORKERS=4
SIGNING_METHOD=ecdsa

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=strong_password_here
REDIS_DB=0
REDIS_TTL=3600
REDIS_MAX_CONNECTIONS=50

# TEE Configuration
TEE_MODE=production

# Security
CORS_ORIGINS=https://yourdomain.com
API_KEY_HEADER=X-API-Key
RATE_LIMIT_PER_MINUTE=100
```

## Backup & Recovery

### Redis Backup

```bash
# Manual backup
docker exec redis redis-cli --rdb /data/backup.rdb BGSAVE

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups/redis"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec redis redis-cli --rdb /data/dump.rdb BGSAVE
docker cp redis:/data/dump.rdb $BACKUP_DIR/redis_$TIMESTAMP.rdb

# Keep only last 7 days
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete
```

### Disaster Recovery

1. **RTO (Recovery Time Objective)**: < 1 hour
2. **RPO (Recovery Point Objective)**: < 15 minutes

Recovery procedure:
```bash
# 1. Restore Redis data
docker cp backup.rdb redis:/data/dump.rdb
docker restart redis

# 2. Redeploy services
docker compose -f docker-compose.prod.yml up -d

# 3. Verify services
./scripts/health-check.sh
```

## Security Hardening

### Production Checklist

- [ ] SSL/TLS certificates configured
- [ ] Security headers enabled
- [ ] Rate limiting implemented
- [ ] API authentication enabled
- [ ] Secrets stored securely (not in code)
- [ ] Redis password is strong
- [ ] TEE attestation enabled
- [ ] Monitoring alerts configured
- [ ] Backup strategy implemented
- [ ] Incident response plan documented

### Security Scanning

```bash
# Scan Docker images
docker scan hashwarlock/pii-tee-api:latest
docker scan hashwarlock/pii-tee-frontend:latest

# Security audit
npm audit --production
pip-audit -r requirements.txt

# Penetration testing
nikto -h https://yourdomain.com
nmap -sV -sC yourdomain.com
```

## Scaling Considerations

### Horizontal Scaling

- **API**: Stateless, scale based on CPU/memory
- **Frontend**: CDN for static assets
- **Redis**: Redis Cluster for high availability

### Vertical Scaling

Recommended specifications:
- **Small** (< 100 users): 2 CPU, 4GB RAM
- **Medium** (< 1000 users): 4 CPU, 8GB RAM  
- **Large** (< 10000 users): 8 CPU, 16GB RAM

## Troubleshooting

### Common Issues

1. **TEE not available**
   - Check TEE hardware support
   - Verify dstack service is running
   - Check socket permissions

2. **Redis connection failed**
   - Verify Redis is running
   - Check password configuration
   - Test network connectivity

3. **High latency**
   - Check resource utilization
   - Review Redis memory usage
   - Enable caching where possible

## Next Steps

- 📖 [Monitoring Guide](./MONITORING.md) - Set up observability
- 🔒 [Security Guide](./SECURITY.md) - Security best practices
- 🧪 [Testing Guide](./TESTING.md) - Test in production
- 📊 [Performance Tuning](./PERFORMANCE.md) - Optimize deployment