# Testing Guide

## Overview

This guide covers testing strategies for PII-TEE, including unit tests, integration tests, end-to-end tests, and TEE simulator testing.

## Quick Test Commands

```bash
# Run all tests
make test

# Test signature verification
./scripts/test/test-signature-verification.sh

# Test with TEE simulator
./scripts/setup_tee_simulator.sh start
./scripts/test/test-tee-integration.sh

# Test API endpoints
./scripts/test/test-api.sh

# Load testing
./scripts/test/load-test.sh
```

## Testing Strategy

### 1. Unit Tests

Test individual components in isolation.

#### API Unit Tests

Create `src/api/tests/test_services.py`:

```python
import pytest
from services.quote.quote_service import QuoteService
from services.presidio.python_presidio_service import PythonPresidioService

class TestQuoteService:
    def test_ecdsa_signature(self):
        service = QuoteService(signing_method="ecdsa")
        service.init()
        
        content = "Test message"
        signature = service.sign_content(content)
        
        assert signature is not None
        assert signature.startswith("0x")
        
        # Verify the signature
        is_valid = service.verify_signature(
            content, 
            signature, 
            service.public_key, 
            "ecdsa"
        )
        assert is_valid == True
    
    def test_ed25519_signature(self):
        service = QuoteService(signing_method="ed25519")
        service.init()
        
        content = "Test message"
        signature = service.sign_content(content)
        
        assert signature is not None
        assert len(signature) == 128  # Ed25519 signatures are 64 bytes (128 hex)
        
        is_valid = service.verify_signature(
            content,
            signature,
            service.public_key,
            "ed25519"
        )
        assert is_valid == True

class TestPresidioService:
    def test_anonymization(self):
        service = PythonPresidioService()
        
        text = "John Doe lives at john@example.com"
        session_id = "test-session"
        
        anonymized, mappings = service.anonymize_text(
            session_id, text, "en", {}
        )
        
        assert "John Doe" not in anonymized
        assert "<PERSON_0>" in anonymized
        assert "john@example.com" not in anonymized
        assert "<EMAIL_ADDRESS_0>" in anonymized
    
    def test_consistent_anonymization(self):
        service = PythonPresidioService()
        
        text = "John Doe met John Doe"
        session_id = "test-session"
        
        anonymized, mappings = service.anonymize_text(
            session_id, text, "en", {}
        )
        
        # Same entity should get same replacement
        assert anonymized == "<PERSON_0> met <PERSON_0>"
```

Run unit tests:
```bash
cd src/api
pytest tests/ -v
```

#### Frontend Unit Tests

Create `src/client_app/src/__tests__/components.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageDetails } from '@/components/message-details'

describe('MessageDetails', () => {
  it('renders anonymize message correctly', () => {
    const mockData = {
      session_id: 'test-123',
      text: '<PERSON_0> lives here',
      signature: '0xabc123',
      public_key: '0x123abc',
      signing_method: 'ecdsa'
    }
    
    render(
      <MessageDetails 
        type="anonymize"
        data={mockData}
        timestamp={new Date()}
      />
    )
    
    expect(screen.getByText('<PERSON_0> lives here')).toBeInTheDocument()
    expect(screen.getByText('ECDSA')).toBeInTheDocument()
  })
  
  it('expands to show full details', () => {
    const mockData = {
      session_id: 'test-123',
      text: 'Test',
      public_key: '0x' + 'a'.repeat(40),
      signature: '0x' + 'b'.repeat(130)
    }
    
    const { container } = render(
      <MessageDetails 
        type="anonymize"
        data={mockData}
        timestamp={new Date()}
      />
    )
    
    // Click expand button
    const expandBtn = container.querySelector('button')
    fireEvent.click(expandBtn!)
    
    // Check full public key is visible
    expect(screen.getByText('0x' + 'a'.repeat(40))).toBeInTheDocument()
  })
})
```

Run frontend tests:
```bash
cd src/client_app
npm test
```

### 2. Integration Tests

Test component interactions.

#### API Integration Tests

Create `scripts/test/test-api-integration.sh`:

```bash
#!/bin/bash

set -e

API_URL="http://localhost:8080"
echo "🧪 API Integration Tests"
echo "========================"

# Test 1: Full anonymize/deanonymize flow
echo "Test 1: Anonymize → Verify → Deanonymize"

# Anonymize
RESPONSE=$(curl -s -X POST "$API_URL/anonymize" \
  -H "Content-Type: application/json" \
  -d '{"text": "John Doe email: john@example.com"}')

SESSION_ID=$(echo "$RESPONSE" | jq -r '.session_id')
ANON_TEXT=$(echo "$RESPONSE" | jq -r '.text')
SIGNATURE=$(echo "$RESPONSE" | jq -r '.signature')
PUBLIC_KEY=$(echo "$RESPONSE" | jq -r '.public_key')
METHOD=$(echo "$RESPONSE" | jq -r '.signing_method')

echo "✓ Anonymized: $ANON_TEXT"

# Verify signature
VERIFY=$(curl -s -G "$API_URL/verify-signature" \
  --data-urlencode "content=$ANON_TEXT" \
  --data-urlencode "signature=$SIGNATURE" \
  --data-urlencode "public_key=$PUBLIC_KEY" \
  --data-urlencode "signing_method=$METHOD")

IS_VALID=$(echo "$VERIFY" | jq -r '.data.is_valid')
if [ "$IS_VALID" = "true" ]; then
  echo "✓ Signature verified"
else
  echo "✗ Signature verification failed"
  exit 1
fi

# Deanonymize
DEANON=$(curl -s -X POST "$API_URL/deanonymize" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$ANON_TEXT\", \"session_id\": \"$SESSION_ID\"}")

ORIGINAL=$(echo "$DEANON" | jq -r '.text')
echo "✓ Deanonymized: $ORIGINAL"

# Test 2: Session isolation
echo -e "\nTest 2: Session Isolation"

# Create two sessions
RESPONSE1=$(curl -s -X POST "$API_URL/anonymize" \
  -H "Content-Type: application/json" \
  -d '{"text": "Alice"}')
SESSION1=$(echo "$RESPONSE1" | jq -r '.session_id')
ANON1=$(echo "$RESPONSE1" | jq -r '.text')

RESPONSE2=$(curl -s -X POST "$API_URL/anonymize" \
  -H "Content-Type: application/json" \
  -d '{"text": "Bob"}')
SESSION2=$(echo "$RESPONSE2" | jq -r '.session_id')
ANON2=$(echo "$RESPONSE2" | jq -r '.text')

# Both should be <PERSON_0> in their respective sessions
if [ "$ANON1" = "<PERSON_0>" ] && [ "$ANON2" = "<PERSON_0>" ]; then
  echo "✓ Sessions properly isolated"
else
  echo "✗ Session isolation failed"
  exit 1
fi

echo -e "\n✅ All integration tests passed!"
```

### 3. End-to-End Tests

Test the complete user flow.

#### Playwright E2E Tests

Create `src/client_app/tests/e2e/chat.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Chat Interface', () => {
  test('anonymizes and verifies text', async ({ page }) => {
    await page.goto('http://localhost:3000')
    
    // Enter text with PII
    const input = page.locator('input[placeholder="Enter text..."]').first()
    await input.fill('John Doe lives at john@example.com')
    
    // Send message
    await page.keyboard.press('Enter')
    
    // Wait for anonymization
    await page.waitForTimeout(1000)
    
    // Check anonymized text appears in LLM view
    const llmView = page.locator('text=LLM View').locator('..')
    await expect(llmView).toContainText('<PERSON_0>')
    await expect(llmView).toContainText('<EMAIL_ADDRESS_0>')
    
    // Check verification appears
    const verifyView = page.locator('text=Message Signature Verification').locator('..')
    await expect(verifyView).toContainText('Verified')
  })
  
  test('shows expandable details', async ({ page }) => {
    await page.goto('http://localhost:3000')
    
    // Send a message
    const input = page.locator('input[placeholder="Enter text..."]').first()
    await input.fill('Test message')
    await page.keyboard.press('Enter')
    
    await page.waitForTimeout(1000)
    
    // Find and click expand button in LLM view
    const expandBtn = page.locator('svg').filter({ hasText: 'ChevronDown' }).first()
    await expandBtn.click()
    
    // Check full details are visible
    await expect(page.locator('text=Public Key')).toBeVisible()
    await expect(page.locator('text=Signature')).toBeVisible()
    await expect(page.locator('text=Session ID')).toBeVisible()
  })
})
```

Run E2E tests:
```bash
cd src/client_app
npx playwright test
```

### 4. TEE Simulator Testing

Test with simulated TEE environment.

#### Setup TEE Simulator

```bash
# Start simulator
./scripts/setup_tee_simulator.sh start

# Verify it's running
./scripts/setup_tee_simulator.sh status

# Run tests
./scripts/test/test-tee-integration.sh
```

#### TEE Integration Test

Create `scripts/test/test-tee-integration.sh`:

```bash
#!/bin/bash

echo "🔒 TEE Integration Tests"
echo "========================"

# Check if TEE simulator is running
if ! ./scripts/setup_tee_simulator.sh status | grep -q "running"; then
  echo "⚠️  TEE simulator not running. Starting..."
  ./scripts/setup_tee_simulator.sh start
  sleep 5
fi

# Test with TEE enabled
export TEE_MODE=enabled
API_URL="http://localhost:8080"

# Test quote generation
echo "Testing TEE quote generation..."
RESPONSE=$(curl -s -X POST "$API_URL/anonymize" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test with TEE"}')

QUOTE=$(echo "$RESPONSE" | jq -r '.quote')

if [[ "$QUOTE" != "MOCK_QUOTE_"* ]]; then
  echo "✓ Real TEE quote generated"
else
  echo "⚠️  Mock quote detected (TEE simulator may not be properly configured)"
fi

# Test attestation verification
echo "Testing attestation verification..."
# Add attestation verification logic here

echo "✅ TEE integration tests completed"
```

### 5. Load Testing

Test system performance under load.

#### Locust Load Test

Create `src/api/tests/locustfile.py`:

```python
from locust import HttpUser, task, between
import uuid
import random

class PIITEEUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        self.session_id = None
        self.anonymized_texts = []
    
    @task(3)
    def anonymize(self):
        texts = [
            "John Doe lives at john@example.com",
            "Call Alice at 555-1234",
            "Bob's credit card is 4111-1111-1111-1111",
            "Meeting at 123 Main St, New York"
        ]
        
        response = self.client.post("/anonymize", json={
            "text": random.choice(texts),
            "session_id": self.session_id
        })
        
        if response.status_code == 200:
            data = response.json()
            self.session_id = data.get("session_id")
            self.anonymized_texts.append(data.get("text"))
    
    @task(1)
    def deanonymize(self):
        if self.session_id and self.anonymized_texts:
            self.client.post("/deanonymize", json={
                "text": random.choice(self.anonymized_texts),
                "session_id": self.session_id
            })
    
    @task(2)
    def verify_signature(self):
        # Test signature verification
        self.client.get("/verify-signature", params={
            "content": "test",
            "signature": "0xabc123",
            "public_key": "0x123abc",
            "signing_method": "ecdsa"
        })
```

Run load test:
```bash
cd src/api/tests
locust -f locustfile.py --host=http://localhost:8080 --users=100 --spawn-rate=10
```

### 6. Security Testing

#### SQL Injection Test
```bash
curl -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d '{"text": "Test'\'' OR 1=1--"}'
```

#### XSS Test
```bash
curl -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d '{"text": "<script>alert(\"XSS\")</script>"}'
```

#### Large Input Test
```bash
# Generate large text
TEXT=$(python3 -c "print('A' * 1000000)")
curl -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$TEXT\"}"
```

## Continuous Integration

### GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Install dependencies
        run: |
          cd src/api
          pip install -r requirements.txt
          pip install pytest pytest-cov
      
      - name: Run tests
        run: |
          cd src/api
          pytest tests/ --cov=services --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
  
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd src/client_app
          npm ci
      
      - name: Run tests
        run: |
          cd src/client_app
          npm test
      
      - name: Build
        run: |
          cd src/client_app
          npm run build
  
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start services
        run: |
          docker compose up -d
          sleep 10
      
      - name: Run integration tests
        run: |
          ./scripts/test/test-api-integration.sh
          ./scripts/test/test-signature-verification.sh
      
      - name: Stop services
        if: always()
        run: docker compose down
```

## Test Coverage Goals

| Component | Target Coverage | Current |
|-----------|----------------|---------|
| API Services | 80% | - |
| Frontend Components | 70% | - |
| Integration Tests | 90% | - |
| E2E Critical Paths | 100% | - |

## Debugging Tests

### Enable Verbose Logging

```python
# In tests
import logging
logging.basicConfig(level=logging.DEBUG)

# In API
export LOG_LEVEL=DEBUG
```

### Debug Frontend Tests

```bash
# Run tests in watch mode
npm test -- --watch

# Debug in VS Code
npm test -- --inspect-brk
```

### Docker Test Environment

```bash
# Run tests in Docker
docker compose -f docker-compose.test.yml up --abort-on-container-exit

# Debug container
docker compose exec pii-api bash
python -m pytest tests/ -v
```

## Next Steps

- 📖 [Deployment Guide](./DEPLOYMENT.md) - Deploy to production
- 🔒 [Security Guide](./SECURITY.md) - Security testing
- 🏗️ [Architecture](./ARCHITECTURE.md) - System design
- 📊 [Monitoring](./MONITORING.md) - Observability setup