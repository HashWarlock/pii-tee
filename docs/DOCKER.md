# Docker Setup for PII-TEE

This document provides instructions for running the PII-TEE application stack using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB free RAM
- Port 3000 (frontend) and 8080 (API) available

## Quick Start

1. **Clone and navigate to the project:**
   ```bash
   git clone <repository-url>
   cd pii-tee
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set required environment variables:**
   ```bash
   # Minimum required configuration
   REDIS_PASSWORD="your_secure_password_123"
   ```

4. **Start the application:**
   ```bash
   # Development mode
   docker-compose up -d
   
   # Production mode
   docker-compose -f docker-compose.prod.yml up -d
   ```

5. **Access the application:**
   - Frontend: http://localhost:3000
   - API: http://localhost:8080
   - Redis: localhost:6379 (internal)

## Services Overview

### Frontend Service (pii-tee-frontend)
- **Technology**: Next.js 15.4.7 with TypeScript
- **Runtime**: Node.js LTS (Latest Stable)
- **Port**: 3000 (configurable via CLIENT_PORT)
- **Image**: `pii-tee-frontend:local` (dev) / `hashwarlock/pii-tee-frontend:latest` (prod)
- **Features**: 
  - Responsive design with mobile support
  - Real-time chat interface
  - TEE verification display
  - Accessibility compliant (WCAG)
  - Error boundaries for graceful error handling
  - Loading skeletons for better UX
  - Micro-interactions and animations

### API Service (pii-api)
- **Technology**: FastAPI with Presidio
- **Port**: 8080 (configurable via API_PORT)
- **Features**:
  - Text anonymization/deanonymization
  - TEE attestation via Intel SGX
  - Session management

### Redis Service
- **Technology**: Redis 7.4 Alpine
- **Port**: 6379 (internal only)
- **Features**:
  - Session state persistence
  - Configurable memory limits
  - Data persistence via volumes

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_PASSWORD` | *(required)* | Strong password for Redis authentication |
| `LISTEN_IP` | `127.0.0.1` | IP address to bind services |
| `API_PORT` | `8080` | Port for PII API service |
| `CLIENT_PORT` | `3000` | Port for frontend client |
| `EXTERNAL_HOST` | `localhost` | External hostname for API calls |
| `NODE_ENV` | `production` | Node.js environment mode |

### Docker Compose Files

- `docker-compose.yml` - Development/testing environment
- `docker-compose.prod.yml` - Production environment with optimizations
- `docker-compose.dev.yml` - Development with hot reload support

## Development Workflow

### Local Development with Docker

1. **Start services:**
   ```bash
   # Basic development
   docker-compose up -d
   
   # Development with hot reload
   docker-compose -f docker-compose.dev.yml up
   
   # Using Makefile shortcuts
   make dev      # Start dev environment
   make prod     # Start production
   make build    # Build all images
   ```

2. **View logs:**
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f pii-frontend
   ```

3. **Rebuild after code changes:**
   ```bash
   # Rebuild frontend only
   docker-compose build client-app
   docker-compose up -d client-app
   
   # Rebuild all services
   docker-compose build
   docker-compose up -d
   
   # Force build for specific platform (if needed)
   docker build --platform linux/amd64 -t pii-tee-frontend:local ./src/client_app
   
   # Using Makefile shortcuts
   make frontend  # Build frontend only
   make api       # Build API only
   make build     # Build everything
   ```

### Production Deployment

1. **Use production compose file:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Configure external access:**
   ```bash
   # Update environment for external access
   export EXTERNAL_HOST=your-domain.com
   export LISTEN_IP=0.0.0.0
   ```

3. **SSL/TLS termination** (recommended):
   - Use a reverse proxy (nginx, Traefik, etc.)
   - Terminate SSL at the proxy level
   - Forward traffic to frontend (port 3000) and API (port 8080)

## Health Checks

All services include health checks:

- **Frontend**: `GET /api/health` - Returns application status
- **API**: `GET /health` - Returns API and Redis connectivity
- **Redis**: Built-in Redis ping

Check health status:
```bash
docker-compose ps
```

## Troubleshooting

### Common Issues

1. **Port conflicts:**
   ```bash
   # Check if ports are in use
   netstat -tulpn | grep :3000
   netstat -tulpn | grep :8080
   
   # Use different ports
   export CLIENT_PORT=3001
   export API_PORT=8081
   ```

2. **Redis connection issues:**
   ```bash
   # Verify Redis is running
   docker-compose logs redis
   
   # Test Redis connectivity
   docker-compose exec redis redis-cli ping
   ```

3. **Frontend build failures:**
   ```bash
   # Clear Docker build cache
   docker-compose build --no-cache pii-frontend
   
   # Check build logs
   docker-compose build pii-frontend
   ```

4. **Memory issues:**
   ```bash
   # Increase Docker memory limit
   # Check Docker Desktop settings or daemon configuration
   
   # Monitor memory usage
   docker stats
   ```

### Debugging

1. **Access container shells:**
   ```bash
   # Frontend container
   docker-compose exec pii-frontend sh
   
   # API container
   docker-compose exec pii-api bash
   ```

2. **View detailed logs:**
   ```bash
   # Enable debug logging
   docker-compose logs --details pii-frontend
   ```

## Security Considerations

### Production Security

1. **Use strong passwords:**
   ```bash
   # Generate secure Redis password
   openssl rand -base64 32
   ```

2. **Limit network exposure:**
   - Keep Redis internal (no external ports)
   - Use `LISTEN_IP=127.0.0.1` for local-only access
   - Implement reverse proxy for SSL termination

3. **Regular updates:**
   ```bash
   # Update base images
   docker-compose pull
   docker-compose up -d
   ```

### TEE Requirements

- Mount `/var/run/dstack.sock` for TEE functionality
- Ensure host system supports Intel SGX
- Verify dstack service is running on host

## Cross-Platform Builds

The Docker configuration is optimized for `linux/amd64` platform to ensure compatibility with most cloud deployment environments.

### Platform-Specific Builds

```bash
# Build for specific platform
docker build --platform linux/amd64 -t pii-tee-frontend ./src/client_app

# Multi-platform build (requires buildx)
docker buildx build --platform linux/amd64,linux/arm64 -t pii-tee-frontend ./src/client_app

# Check image platform
docker image inspect pii-tee-frontend | grep Architecture
```

### Apple Silicon (M1/M2) Compatibility

On Apple Silicon Macs, the builds will automatically use emulation for `linux/amd64`:

```bash
# Enable emulation if needed
docker run --privileged --rm tonistiigi/binfmt --install all

# Verify buildx availability
docker buildx version
```

## Performance Optimization

### Production Optimizations

1. **Resource limits:**
   ```yaml
   # Add to docker-compose.prod.yml
   deploy:
     resources:
       limits:
         memory: 1G
         cpus: '0.5'
   ```

2. **Caching:**
   - Redis memory optimization via `REDIS_MAXMEMORY`
   - Next.js build optimization enabled
   - Docker layer caching

3. **Monitoring:**
   ```bash
   # Resource usage
   docker stats
   
   # Service health
   curl http://localhost:3000/api/health
   curl http://localhost:8080/health
   ```

## Backup and Recovery

### Data Persistence

- Redis data persists in named volume `redis_data`
- No frontend data persistence (stateless)

### Backup Commands

```bash
# Backup Redis data
docker run --rm -v pii-tee_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore Redis data
docker run --rm -v pii-tee_redis_data:/data -v $(pwd):/backup alpine tar xzf /backup/redis-backup-YYYYMMDD.tar.gz -C /data
```

## Support

For issues and questions:
1. Check service logs: `docker-compose logs [service]`
2. Verify health checks: `docker-compose ps`
3. Review configuration: `.env` file
4. Consult main project documentation