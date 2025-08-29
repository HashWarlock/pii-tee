#!/bin/bash

# PII-TEE Comprehensive Test Suite
# Run all tests: unit, integration, end-to-end, and performance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
    ((SKIPPED_TESTS++))
    ((TOTAL_TESTS++))
}

# Header
echo "========================================="
echo "    PII-TEE Comprehensive Test Suite    "
echo "========================================="
echo ""

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    log_error "Python 3 is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    log_error "Node.js/npm is not installed"
    exit 1
fi

log_info "Prerequisites check passed"
echo ""

# 1. Unit Tests - API
echo "========================================="
echo "1. API Unit Tests"
echo "========================================="

if [ -f "src/api/requirements.txt" ]; then
    log_info "Running Python unit tests..."
    
    cd src/api
    
    # Install test dependencies if needed
    if ! python3 -c "import pytest" 2>/dev/null; then
        log_info "Installing pytest..."
        pip install pytest pytest-cov pytest-asyncio
    fi
    
    # Run tests
    if python3 -m pytest tests/ -v --cov=services --cov-report=term-missing; then
        log_success "API unit tests passed"
    else
        log_error "API unit tests failed"
    fi
    
    cd ../..
else
    log_warning "API unit tests skipped (requirements.txt not found)"
fi

echo ""

# 2. Unit Tests - Frontend
echo "========================================="
echo "2. Frontend Unit Tests"
echo "========================================="

if [ -f "src/client_app/package.json" ]; then
    log_info "Running frontend unit tests..."
    
    cd src/client_app
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm install
    fi
    
    # Run tests
    if npm test -- --watchAll=false --passWithNoTests; then
        log_success "Frontend unit tests passed"
    else
        log_error "Frontend unit tests failed"
    fi
    
    cd ../..
else
    log_warning "Frontend unit tests skipped (package.json not found)"
fi

echo ""

# 3. Integration Tests
echo "========================================="
echo "3. Integration Tests"
echo "========================================="

log_info "Starting services for integration tests..."

# Start services
docker-compose up -d

# Wait for services to be ready
log_info "Waiting for services to start..."
sleep 10

# Check if services are healthy
if curl -sf http://localhost:8080/health > /dev/null; then
    log_info "API service is healthy"
else
    log_error "API service is not healthy"
    docker-compose logs pii-api
    docker-compose down
    exit 1
fi

# Run integration tests
log_info "Running integration tests..."

# Test anonymization flow
if ./scripts/test/test-api-integration.sh > /dev/null 2>&1; then
    log_success "API integration tests passed"
else
    log_error "API integration tests failed"
fi

# Test signature verification
if ./scripts/test/test-signature-verification.sh > /dev/null 2>&1; then
    log_success "Signature verification tests passed"
else
    log_error "Signature verification tests failed"
fi

echo ""

# 4. End-to-End Tests
echo "========================================="
echo "4. End-to-End Tests"
echo "========================================="

if [ -f "src/client_app/package.json" ]; then
    log_info "Running E2E tests..."
    
    cd src/client_app
    
    # Install Playwright if needed
    if ! npx playwright --version > /dev/null 2>&1; then
        log_info "Installing Playwright..."
        npm install -D @playwright/test
        npx playwright install
    fi
    
    # Run E2E tests
    if npx playwright test --reporter=list; then
        log_success "E2E tests passed"
    else
        log_error "E2E tests failed"
    fi
    
    cd ../..
else
    log_warning "E2E tests skipped"
fi

echo ""

# 5. Performance Tests
echo "========================================="
echo "5. Performance Tests"
echo "========================================="

log_info "Running performance benchmarks..."

# Test anonymization performance
PERF_TEST_FILE="/tmp/perf_test_$$.txt"
cat > "$PERF_TEST_FILE" << EOF
John Doe lives at 123 Main Street, New York, NY 10001. 
His email is john.doe@example.com and phone number is 555-123-4567.
He works at Acme Corp and his SSN is 123-45-6789.
EOF

# Measure anonymization time
START_TIME=$(date +%s%N)
RESPONSE=$(curl -s -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$(cat $PERF_TEST_FILE)\"}")
END_TIME=$(date +%s%N)

DURATION=$((($END_TIME - $START_TIME) / 1000000))

if [ $DURATION -lt 500 ]; then
    log_success "Anonymization performance: ${DURATION}ms (< 500ms target)"
else
    log_error "Anonymization performance: ${DURATION}ms (> 500ms target)"
fi

rm -f "$PERF_TEST_FILE"

# Test concurrent requests
log_info "Testing concurrent request handling..."

for i in {1..10}; do
    curl -s -X POST http://localhost:8080/anonymize \
        -H "Content-Type: application/json" \
        -d '{"text": "Test concurrent request '$i'"}' > /dev/null &
done

wait

log_success "Concurrent request test completed"

echo ""

# 6. Security Tests
echo "========================================="
echo "6. Security Tests"
echo "========================================="

log_info "Running security tests..."

# Test SQL injection
INJECTION_RESPONSE=$(curl -s -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d '{"text": "Test'\'' OR 1=1--"}')

if echo "$INJECTION_RESPONSE" | grep -q "error"; then
    log_error "SQL injection protection may be insufficient"
else
    log_success "SQL injection test passed"
fi

# Test XSS
XSS_RESPONSE=$(curl -s -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d '{"text": "<script>alert(\"XSS\")</script>"}')

if echo "$XSS_RESPONSE" | grep -q "<script>"; then
    log_error "XSS protection may be insufficient"
else
    log_success "XSS test passed"
fi

# Test large input
LARGE_TEXT=$(python3 -c "print('A' * 100000)")
LARGE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$LARGE_TEXT\"}")

if [ "$LARGE_RESPONSE" = "200" ] || [ "$LARGE_RESPONSE" = "413" ]; then
    log_success "Large input handling test passed"
else
    log_error "Large input handling test failed (HTTP $LARGE_RESPONSE)"
fi

echo ""

# 7. TEE Simulator Tests
echo "========================================="
echo "7. TEE Simulator Tests"
echo "========================================="

if [ -f "./scripts/setup_tee_simulator.sh" ]; then
    log_info "Testing with TEE simulator..."
    
    # Start TEE simulator
    ./scripts/setup_tee_simulator.sh start > /dev/null 2>&1
    
    sleep 5
    
    # Run TEE tests
    if ./scripts/test/test-tee-integration.sh > /dev/null 2>&1; then
        log_success "TEE integration tests passed"
    else
        log_error "TEE integration tests failed"
    fi
    
    # Stop TEE simulator
    ./scripts/setup_tee_simulator.sh stop > /dev/null 2>&1
else
    log_warning "TEE simulator tests skipped (setup script not found)"
fi

echo ""

# 8. Load Tests (Optional)
echo "========================================="
echo "8. Load Tests (Optional)"
echo "========================================="

if command -v locust &> /dev/null; then
    log_info "Running load tests with Locust..."
    
    # Run brief load test
    cd src/api/tests
    locust -f locustfile.py \
        --host=http://localhost:8080 \
        --users=10 \
        --spawn-rate=2 \
        --run-time=30s \
        --headless \
        --only-summary > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        log_success "Load tests completed"
    else
        log_error "Load tests failed"
    fi
    
    cd ../../..
else
    log_warning "Load tests skipped (Locust not installed)"
fi

echo ""

# Cleanup
echo "========================================="
echo "Cleanup"
echo "========================================="

log_info "Stopping services..."
docker-compose down

echo ""

# Test Summary
echo "========================================="
echo "Test Summary"
echo "========================================="
echo ""
echo "Total Tests:   $TOTAL_TESTS"
echo -e "${GREEN}Passed:${NC}        $PASSED_TESTS"
echo -e "${RED}Failed:${NC}        $FAILED_TESTS"
echo -e "${YELLOW}Skipped:${NC}       $SKIPPED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
    exit 1
fi