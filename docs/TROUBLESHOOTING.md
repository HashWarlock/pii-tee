# Troubleshooting Guide

## Common Issues and Solutions

### Installation Issues

#### Docker Compose Fails to Start

**Symptom:** 
```
Error response from daemon: driver failed programming external connectivity
```

**Solution:**
```bash
# Check if ports are already in use
lsof -i :3000  # Frontend port
lsof -i :8080  # API port
lsof -i :6379  # Redis port

# Kill processes using the ports
kill -9 <PID>

# Or use different ports
CLIENT_PORT=3001 API_PORT=8081 docker compose up
```

#### Node Modules Installation Fails

**Symptom:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock
rm -rf node_modules package-lock.json

# Reinstall with legacy peer deps
npm install --legacy-peer-deps
```

#### Python Dependencies Conflict

**Symptom:**
```
ERROR: pip's dependency resolver does not currently take into account all the packages
```

**Solution:**
```bash
# Use virtual environment
python -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install with no cache
pip install --no-cache-dir -r requirements.txt
```

### API Issues

#### Anonymization Returns Empty Response

**Symptom:** API returns `{"text": "", "session_id": null}`

**Diagnosis:**
```bash
# Check API logs
docker logs pii-api-dev --tail 50

# Test directly
curl -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message"}'
```

**Common Causes:**
1. Presidio models not downloaded
2. Invalid input format
3. Redis connection failed

**Solution:**
```bash
# Download language models
docker exec pii-api-dev python -m spacy download en_core_web_lg

# Check Redis connection
docker exec pii-api-dev python -c "
import redis
r = redis.Redis(host='redis', password='your_password')
print(r.ping())
"
```

#### Signature Verification Always Fails

**Symptom:** All signatures show as invalid

**Diagnosis:**
```python
# Test signature generation and verification
curl -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d '{"text": "Test"}' | jq

# Copy the response values and verify
curl -G http://localhost:8080/verify-signature \
  --data-urlencode "content=<text>" \
  --data-urlencode "signature=<signature>" \
  --data-urlencode "public_key=<public_key>" \
  --data-urlencode "signing_method=<signing_method>"
```

**Solution:**
```python
# Check signing method configuration
docker exec pii-api-dev python -c "
import os
print('SIGNING_METHOD:', os.getenv('SIGNING_METHOD', 'ecdsa'))
"

# Verify quote service initialization
docker logs pii-api-dev | grep -i "quote"
```

#### Session Not Found Error

**Symptom:** Deanonymization fails with "Session not found"

**Solution:**
```bash
# Check Redis is running
docker compose ps redis

# Verify Redis has data
docker exec redis_dev redis-cli -a $REDIS_PASSWORD keys "*"

# Check session TTL
docker exec redis_dev redis-cli -a $REDIS_PASSWORD ttl <session_id>

# Increase TTL if needed (in .env)
REDIS_TTL=7200  # 2 hours instead of default 1 hour
```

### Frontend Issues

#### Blank Page or Loading Forever

**Symptom:** Frontend loads but shows blank page

**Diagnosis:**
```bash
# Check browser console for errors
# Open Developer Tools > Console

# Check frontend logs
docker logs pii-frontend-dev --tail 50

# Verify API connection
curl http://localhost:3000/api/health
```

**Solution:**
```javascript
// Check API URL configuration
docker exec pii-frontend-dev printenv | grep API

// Rebuild frontend
docker compose build client-app --no-cache
docker compose up -d client-app
```

#### Messages Not Appearing in Chat

**Symptom:** Send message but nothing appears

**Common Causes:**
1. API connection failed
2. WebSocket disconnected
3. State management issue

**Solution:**
```bash
# Check network tab in browser DevTools
# Look for failed API calls

# Restart services
docker compose restart

# Clear browser cache
# Cmd/Ctrl + Shift + R
```

### TEE/Signature Issues

#### TEE Socket Not Available

**Symptom:**
```
FileNotFoundError: Unix socket file /var/run/tappd.sock does not exist
```

**Solution:**
```bash
# In development, this is expected
# The service falls back to mock quotes

# For production with TEE:
# 1. Verify TEE hardware support
lscpu | grep -i sgx

# 2. Check dstack service
systemctl status tappd

# 3. Check socket permissions
ls -la /var/run/tappd.sock
```

#### Mock Quotes in Production

**Symptom:** Production shows "MOCK_QUOTE_" instead of real attestation

**Solution:**
```bash
# Verify TEE is properly configured
docker exec pii-api-dev python -c "
from dstack_sdk import TappdClient
client = TappdClient()
print(client.tdx_quote('test'))
"

# Mount the socket in docker-compose
volumes:
  - /var/run/tappd.sock:/var/run/tappd.sock
```

### Performance Issues

#### Slow Response Times

**Diagnosis:**
```bash
# Check resource usage
docker stats

# Monitor API response times
time curl -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d '{"text": "Test"}'
```

**Solutions:**

1. **Increase resources:**
```yaml
# docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

2. **Enable caching:**
```python
# Add Redis caching for signatures
from functools import lru_cache

@lru_cache(maxsize=1000)
def verify_signature_cached(content, signature, public_key):
    return verify_signature(content, signature, public_key)
```

3. **Optimize Presidio:**
```python
# Use lighter models for faster processing
analyzer = AnalyzerEngine(
    default_score_threshold=0.7,  # Increase threshold
    supported_languages=["en"]     # Only load needed languages
)
```

### Redis Issues

#### Redis Connection Refused

**Symptom:**
```
redis.exceptions.ConnectionError: Error -2 connecting to redis:6379
```

**Solution:**
```bash
# Check Redis is running
docker compose ps redis

# Test connection
docker exec redis_dev redis-cli ping

# Check password
docker exec redis_dev redis-cli -a $REDIS_PASSWORD ping

# Verify network
docker network ls
docker network inspect pii-tee_pii_network
```

#### Redis Out of Memory

**Symptom:**
```
OOM command not allowed when used memory > 'maxmemory'
```

**Solution:**
```bash
# Check memory usage
docker exec redis_dev redis-cli -a $REDIS_PASSWORD info memory

# Increase memory limit
docker exec redis_dev redis-cli -a $REDIS_PASSWORD config set maxmemory 512mb

# Set eviction policy
docker exec redis_dev redis-cli -a $REDIS_PASSWORD config set maxmemory-policy allkeys-lru

# Or in docker-compose.yml
command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### Docker Issues

#### Container Keeps Restarting

**Diagnosis:**
```bash
# Check container status
docker compose ps

# View logs
docker logs <container_name> --tail 100

# Check exit code
docker inspect <container_name> --format='{{.State.ExitCode}}'
```

**Common Solutions:**

1. **Fix healthcheck:**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:80/health"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 40s  # Give more time to start
```

2. **Check dependencies:**
```yaml
depends_on:
  redis:
    condition: service_healthy  # Wait for Redis to be healthy
```

#### Build Cache Issues

**Symptom:** Changes not reflected after rebuild

**Solution:**
```bash
# Clear all Docker cache
docker system prune -a

# Rebuild without cache
docker compose build --no-cache

# Remove specific images
docker rmi pii-api:dev pii-frontend:dev

# Full cleanup and rebuild
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

## Debugging Tools

### API Debugging

```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Add debug endpoints
@app.get("/debug/config")
async def debug_config():
    return {
        "signing_method": os.getenv("SIGNING_METHOD"),
        "redis_host": os.getenv("REDIS_HOST"),
        "tee_available": os.path.exists("/var/run/tappd.sock")
    }
```

### Frontend Debugging

```javascript
// Add debug logging
console.log('[DEBUG] API Response:', response);
console.log('[DEBUG] Session ID:', sessionId);

// Enable React DevTools
if (process.env.NODE_ENV === 'development') {
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inject = function () {};
}
```

### Network Debugging

```bash
# Test connectivity between containers
docker exec pii-frontend-dev ping pii-api
docker exec pii-api-dev ping redis

# Check DNS resolution
docker exec pii-frontend-dev nslookup pii-api
docker exec pii-api-dev nslookup redis

# Monitor network traffic
docker exec pii-api-dev tcpdump -i any -n port 6379
```

## Health Checks

### System Health Check Script

Create `scripts/health-check.sh`:

```bash
#!/bin/bash

echo "🏥 PII-TEE Health Check"
echo "======================"

# Check services are running
echo -n "Docker Compose: "
if docker compose ps | grep -q "Up"; then
  echo "✅ Running"
else
  echo "❌ Not running"
  exit 1
fi

# Check API
echo -n "API Health: "
if curl -sf http://localhost:8080/health > /dev/null; then
  echo "✅ Healthy"
else
  echo "❌ Unhealthy"
fi

# Check Frontend
echo -n "Frontend Health: "
if curl -sf http://localhost:3000 > /dev/null; then
  echo "✅ Healthy"
else
  echo "❌ Unhealthy"
fi

# Check Redis
echo -n "Redis Health: "
if docker exec redis_dev redis-cli ping | grep -q PONG; then
  echo "✅ Healthy"
else
  echo "❌ Unhealthy"
fi

# Test anonymization
echo -n "Anonymization Test: "
RESPONSE=$(curl -sf -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d '{"text": "John Doe"}')

if echo "$RESPONSE" | grep -q "<PERSON_0>"; then
  echo "✅ Working"
else
  echo "❌ Failed"
fi

echo "======================"
echo "✅ Health check complete"
```

## Getting Help

### Log Collection

When reporting issues, collect:

```bash
# Collect all logs
docker compose logs > pii-tee-logs.txt

# System information
echo "=== System Info ===" >> debug-info.txt
uname -a >> debug-info.txt
docker version >> debug-info.txt
docker compose version >> debug-info.txt

# Configuration
echo "=== Configuration ===" >> debug-info.txt
cat .env >> debug-info.txt
docker compose config >> debug-info.txt
```

### Support Channels

1. **GitHub Issues**: [Report bugs](https://github.com/HashWarlock/pii-tee/issues)
2. **Discussions**: [Ask questions](https://github.com/HashWarlock/pii-tee/discussions)
3. **Documentation**: Check [FAQ](./FAQ.md) first

### Debug Mode

Enable comprehensive debug mode:

```bash
# Set in .env
LOG_LEVEL=DEBUG
DEBUG=true

# Restart services
docker compose restart

# Watch logs
docker compose logs -f
```

## Next Steps

- 📖 [FAQ](./FAQ.md) - Frequently asked questions
- 🚀 [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- 🔒 [Security Guide](./SECURITY.md) - Security considerations
- 📊 [Performance Guide](./PERFORMANCE.md) - Performance optimization