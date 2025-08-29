# TEE Simulator Testing Guide

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Testing Scenarios](#testing-scenarios)
- [API Integration Testing](#api-integration-testing)
- [Troubleshooting](#troubleshooting)
- [Performance Testing](#performance-testing)
- [CI/CD Integration](#cicd-integration)

## Overview

The dstack TEE (Trusted Execution Environment) simulator provides a local development environment for testing PII anonymization with attestation capabilities. This guide covers comprehensive testing procedures for development, integration, and validation.

### What is dstack?

dstack is Phala Network's SDK for building TEE applications. It provides:
- Secure enclaves for sensitive computation
- Attestation and verification capabilities
- Quote generation for proof of execution
- Cryptographic signing of processed data

## Prerequisites

### System Requirements
- **OS**: macOS (Intel/Apple Silicon) or Linux
- **Memory**: 4GB RAM minimum
- **Storage**: 2GB free space
- **Network**: Internet connection for initial setup

### Software Dependencies
```bash
# Required
- Git 2.0+
- Rust 1.70+ (installed automatically)
- Python 3.8+
- Node.js 16+
- Docker 20.10+

# Optional (for advanced testing)
- jq (JSON processor)
- httpie or curl
- make
```

## Installation

### Quick Setup
```bash
# 1. Clone the repository
git clone <repository-url> pii-tee
cd pii-tee

# 2. Set up environment
cp .env.example .env
# Edit .env with your Redis password

# 3. Install and start TEE simulator
./scripts/setup_tee_simulator.sh setup
./scripts/setup_tee_simulator.sh start

# 4. Verify installation
./scripts/setup_tee_simulator.sh status
```

### Manual Setup

#### Step 1: Build from Source
```bash
# Clone dstack repository
git clone https://github.com/Dstack-TEE/dstack.git .dstack

# Build simulator
cd .dstack/sdk/simulator
cargo build --release

# Create socket directory
mkdir -p .dstack/sdk/simulator
```

#### Step 2: Configure Environment
```bash
# Add to .env
echo "DSTACK_SIMULATOR_ENDPOINT=$PWD/.dstack/sdk/simulator/tappd.sock" >> .env
echo "DSTACK_SIMULATOR_MODE=true" >> .env
```

#### Step 3: Create System Symlink
```bash
# Create symlink for Docker compatibility
sudo ln -sf $PWD/.dstack/sdk/simulator/tappd.sock /var/run/dstack.sock
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DSTACK_SIMULATOR_ENDPOINT` | Path to simulator socket | `.dstack/sdk/simulator/tappd.sock` | Yes |
| `DSTACK_SIMULATOR_MODE` | Enable simulator mode | `true` | Yes |
| `DSTACK_DIR` | dstack repository location | `.dstack` | No |
| `REDIS_PASSWORD` | Redis authentication | - | Yes |

### API Configuration

The API service (`src/api/main.py`) automatically detects the simulator when:
1. Socket file exists at configured path
2. `DSTACK_SIMULATOR_MODE` is set to `true`

```python
# src/api/services/quote/quote_service.py
class QuoteService:
    def __init__(self):
        self.simulator_mode = os.getenv("DSTACK_SIMULATOR_MODE") == "true"
        if self.simulator_mode:
            self.socket_path = os.getenv("DSTACK_SIMULATOR_ENDPOINT")
```

## Testing Scenarios

### 1. Basic Functionality Test

```bash
# Test simulator connectivity
curl -X GET http://localhost:8080/health

# Expected response
{
  "status": "healthy",
  "tee_enabled": true,
  "simulator_mode": true
}
```

### 2. Quote Generation Test

```bash
# Test quote generation
curl -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "John Doe lives at john@example.com",
    "session_id": "test-session-001"
  }'

# Expected response structure
{
  "session_id": "test-session-001",
  "text": "[NAME_1] lives at [EMAIL_1]",
  "quote": "SGX_QUOTE_BASE64...",
  "signature": "SIGNATURE_BASE64...",
  "public_key": "PUBLIC_KEY_BASE64...",
  "signing_method": "ecdsa"
}
```

### 3. Signature Verification Test

```bash
# Verify signature
curl -X POST http://localhost:8080/verify-signature \
  -H "Content-Type: application/json" \
  -d '{
    "content": "[NAME_1] lives at [EMAIL_1]",
    "signature": "SIGNATURE_BASE64...",
    "public_key": "PUBLIC_KEY_BASE64..."
  }'

# Expected response
{
  "valid": true,
  "message": "Signature verified successfully"
}
```

### 4. Session Persistence Test

```python
#!/usr/bin/env python3
# scripts/test/test_session_persistence.py

import requests
import json

API_URL = "http://localhost:8080"
SESSION_ID = "persistence-test-001"

# First request - anonymize
response1 = requests.post(f"{API_URL}/anonymize", json={
    "text": "Contact John Doe at john@example.com",
    "session_id": SESSION_ID
})
anonymized = response1.json()
print(f"Anonymized: {anonymized['text']}")

# Second request - deanonymize
response2 = requests.post(f"{API_URL}/deanonymize", json={
    "text": anonymized['text'],
    "session_id": SESSION_ID
})
deanonymized = response2.json()
print(f"Deanonymized: {deanonymized['text']}")

# Verify round-trip
assert deanonymized['text'] == "Contact John Doe at john@example.com"
print("✅ Session persistence test passed")
```

### 5. Load Testing

```bash
# Using Apache Bench (ab)
ab -n 1000 -c 10 -p test_payload.json \
   -T application/json \
   http://localhost:8080/anonymize

# test_payload.json
{
  "text": "Test user data with email@example.com",
  "session_id": "load-test"
}
```

## API Integration Testing

### Complete Integration Test Suite

```bash
#!/bin/bash
# scripts/test/run-integration-tests.sh

set -e

echo "🧪 Running TEE Simulator Integration Tests"
echo "=========================================="

# 1. Check simulator status
echo "1️⃣ Checking simulator status..."
./scripts/setup_tee_simulator.sh status || exit 1

# 2. Test health endpoint
echo "2️⃣ Testing health endpoint..."
curl -f http://localhost:8080/health || exit 1

# 3. Test anonymization
echo "3️⃣ Testing anonymization..."
SESSION_ID="test-$(date +%s)"
RESPONSE=$(curl -s -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"John Doe, john@example.com\", \"session_id\": \"$SESSION_ID\"}")

echo "Response: $RESPONSE"

# 4. Verify quote exists
if echo "$RESPONSE" | jq -e '.quote' > /dev/null; then
  echo "✅ Quote generated successfully"
else
  echo "❌ Quote generation failed"
  exit 1
fi

# 5. Test deanonymization
echo "4️⃣ Testing deanonymization..."
ANON_TEXT=$(echo "$RESPONSE" | jq -r '.text')
DEANON_RESPONSE=$(curl -s -X POST http://localhost:8080/deanonymize \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$ANON_TEXT\", \"session_id\": \"$SESSION_ID\"}")

echo "Deanonymized: $DEANON_RESPONSE"

# 6. Test signature verification
echo "5️⃣ Testing signature verification..."
SIGNATURE=$(echo "$RESPONSE" | jq -r '.signature')
PUBLIC_KEY=$(echo "$RESPONSE" | jq -r '.public_key')

VERIFY_RESPONSE=$(curl -s -X POST http://localhost:8080/verify-signature \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"$ANON_TEXT\",
    \"signature\": \"$SIGNATURE\",
    \"public_key\": \"$PUBLIC_KEY\"
  }")

echo "Verification: $VERIFY_RESPONSE"

echo ""
echo "✅ All integration tests passed!"
```

### Frontend Integration Testing

```javascript
// scripts/test/test-frontend-integration.js

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

async function testFrontendIntegration() {
  console.log('🧪 Testing Frontend-API Integration with TEE');
  
  try {
    // 1. Test anonymization through frontend proxy
    const response = await fetch(`${API_URL}/anonymize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Test user john@example.com',
        session_id: `frontend-test-${Date.now()}`
      })
    });
    
    const data = await response.json();
    
    // 2. Verify TEE attestation fields
    if (!data.quote || !data.signature) {
      throw new Error('Missing TEE attestation data');
    }
    
    console.log('✅ TEE attestation working');
    console.log(`   Quote length: ${data.quote.length}`);
    console.log(`   Signature: ${data.signature.substring(0, 20)}...`);
    
    // 3. Test streaming endpoint
    const streamResponse = await fetch(`${API_URL}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: data.text,
        session_id: data.session_id
      })
    });
    
    console.log('✅ Streaming endpoint accessible');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

testFrontendIntegration();
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Socket Connection Errors

**Problem**: `Error: Cannot connect to TEE simulator socket`

**Solutions**:
```bash
# Check if simulator is running
ps aux | grep dstack-simulator

# Restart simulator
./scripts/setup_tee_simulator.sh restart

# Check socket file exists
ls -la /var/run/dstack.sock

# Recreate symlink if needed
sudo ln -sf $PWD/.dstack/sdk/simulator/tappd.sock /var/run/dstack.sock
```

#### 2. Build Failures

**Problem**: `error: could not compile dstack-simulator`

**Solutions**:
```bash
# Update Rust toolchain
rustup update stable

# Clean and rebuild
cd .dstack/sdk/simulator
cargo clean
cargo build --release

# For macOS: Install build dependencies
brew install libiconv pkg-config
```

#### 3. Permission Denied

**Problem**: `Permission denied when creating symlink`

**Solutions**:
```bash
# Use sudo for symlink creation
sudo ln -sf $PWD/.dstack/sdk/simulator/tappd.sock /var/run/dstack.sock

# Alternative: Use user-space socket only
export DSTACK_SIMULATOR_ENDPOINT=$HOME/.dstack/tappd.sock
```

#### 4. Quote Generation Failures

**Problem**: `Quote generation failed: simulator not responding`

**Solutions**:
```bash
# Check simulator logs
tail -f .dstack/sdk/simulator/simulator.log

# Increase timeout in API
# Edit src/api/services/quote/quote_service.py
QUOTE_TIMEOUT = 30  # Increase from default 10
```

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
# Set debug environment variables
export DSTACK_DEBUG=true
export LOG_LEVEL=DEBUG

# Start simulator with verbose output
./scripts/setup_tee_simulator.sh start --verbose

# Monitor logs
tail -f .dstack/sdk/simulator/simulator.log
```

## Performance Testing

### Benchmark Suite

```python
#!/usr/bin/env python3
# scripts/test/benchmark_tee.py

import time
import requests
import statistics
from concurrent.futures import ThreadPoolExecutor

API_URL = "http://localhost:8080"
NUM_REQUESTS = 100
CONCURRENT_WORKERS = 10

def benchmark_anonymization():
    """Benchmark anonymization with TEE attestation"""
    
    times = []
    
    def make_request(i):
        start = time.time()
        response = requests.post(f"{API_URL}/anonymize", json={
            "text": f"User {i} with email user{i}@example.com",
            "session_id": f"benchmark-{i}"
        })
        elapsed = time.time() - start
        return elapsed if response.status_code == 200 else None
    
    with ThreadPoolExecutor(max_workers=CONCURRENT_WORKERS) as executor:
        results = list(executor.map(make_request, range(NUM_REQUESTS)))
    
    times = [r for r in results if r is not None]
    
    print(f"📊 Performance Results")
    print(f"  Total requests: {NUM_REQUESTS}")
    print(f"  Successful: {len(times)}")
    print(f"  Average time: {statistics.mean(times):.3f}s")
    print(f"  Median time: {statistics.median(times):.3f}s")
    print(f"  Min time: {min(times):.3f}s")
    print(f"  Max time: {max(times):.3f}s")
    
    if len(times) > 1:
        print(f"  Std deviation: {statistics.stdev(times):.3f}s")

if __name__ == "__main__":
    benchmark_anonymization()
```

### Expected Performance Metrics

| Operation | Expected Time | With TEE | Notes |
|-----------|--------------|----------|-------|
| Anonymization | < 100ms | < 200ms | Includes quote generation |
| Deanonymization | < 50ms | < 50ms | No TEE overhead |
| Signature Verification | < 20ms | < 30ms | Cryptographic validation |
| Session Creation | < 10ms | < 10ms | Redis operation |

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/tee-tests.yml
name: TEE Simulator Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'
    
    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
    
    - name: Build TEE Simulator
      run: |
        ./scripts/setup_tee_simulator.sh setup
    
    - name: Start Services
      run: |
        ./scripts/setup_tee_simulator.sh start
        docker-compose up -d redis api
    
    - name: Run Integration Tests
      run: |
        ./scripts/test/run-integration-tests.sh
    
    - name: Run Performance Tests
      run: |
        python scripts/test/benchmark_tee.py
    
    - name: Upload Test Results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results
        path: |
          .dstack/sdk/simulator/*.log
          test-results/
```

## Advanced Testing

### Multi-Session Testing

Test concurrent sessions with different anonymization contexts:

```python
# scripts/test/test_multi_session.py
import asyncio
import aiohttp

async def test_session(session_id, text):
    async with aiohttp.ClientSession() as session:
        async with session.post(
            'http://localhost:8080/anonymize',
            json={'text': text, 'session_id': session_id}
        ) as response:
            return await response.json()

async def main():
    tasks = [
        test_session(f'session-{i}', f'User {i} data')
        for i in range(100)
    ]
    results = await asyncio.gather(*tasks)
    print(f"Processed {len(results)} sessions concurrently")

asyncio.run(main())
```

### Security Testing

```bash
# Test input validation
curl -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d '{"text": "<script>alert(1)</script>", "session_id": "xss-test"}'

# Test large payloads
dd if=/dev/urandom bs=1M count=10 | base64 | \
  curl -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d @-

# Test rate limiting
for i in {1..1000}; do
  curl -X POST http://localhost:8080/anonymize \
    -H "Content-Type: application/json" \
    -d '{"text": "test", "session_id": "rate-test"}' &
done
```

## Monitoring and Observability

### Health Check Script

```bash
#!/bin/bash
# scripts/monitor_tee.sh

while true; do
  STATUS=$(curl -s http://localhost:8080/health | jq -r '.tee_enabled')
  if [ "$STATUS" != "true" ]; then
    echo "⚠️ TEE simulator not healthy at $(date)"
    ./scripts/setup_tee_simulator.sh restart
  fi
  sleep 30
done
```

### Metrics Collection

```python
# scripts/collect_metrics.py
import psutil
import time

def collect_simulator_metrics():
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
        if 'dstack-simulator' in proc.info['name']:
            print(f"CPU: {proc.info['cpu_percent']}%")
            print(f"Memory: {proc.info['memory_info'].rss / 1024 / 1024:.2f} MB")
            break

while True:
    collect_simulator_metrics()
    time.sleep(5)
```

## Best Practices

1. **Always verify simulator status** before running tests
2. **Use unique session IDs** for each test run
3. **Clean up test data** after test completion
4. **Monitor resource usage** during load tests
5. **Keep simulator updated** with latest dstack releases
6. **Document test failures** with logs and environment details
7. **Use automated testing** in CI/CD pipelines
8. **Test error scenarios** including network failures
9. **Validate attestation data** in production-like environments
10. **Benchmark regularly** to detect performance regressions

## References

- [dstack GitHub Repository](https://github.com/Dstack-TEE/dstack)
- [Phala Network Documentation](https://docs.phala.network)
- [Intel SGX Overview](https://www.intel.com/content/www/us/en/developer/tools/software-guard-extensions/overview.html)
- [TEE Security Best Practices](https://confidentialcomputing.io/resources/)

## Support

For issues related to:
- **TEE Simulator**: Check `.dstack/sdk/simulator/simulator.log`
- **API Integration**: Review `docker logs pii-api`
- **Network Issues**: Verify firewall and socket permissions
- **Build Problems**: Update Rust toolchain and dependencies

---

*Last updated: December 2024*