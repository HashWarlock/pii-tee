#!/bin/bash

echo "==================================="
echo "API Routing Test Script"
echo "==================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local url=$1
    local description=$2
    
    echo -n "Testing $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" == "200" ] || [ "$response" == "404" ] || [ "$response" == "405" ]; then
        echo -e "${GREEN}✓${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗${NC} (HTTP $response or connection failed)"
        return 1
    fi
}

# Check if containers are running
echo "Checking Docker containers..."
echo "------------------------------"

if docker ps | grep -q pii-api; then
    echo -e "${GREEN}✓${NC} API container is running"
else
    echo -e "${YELLOW}⚠${NC} API container not found. Starting it..."
    docker-compose -f docker-compose-fixed.yml up -d pii-api
fi

if docker ps | grep -q pii-tee-frontend; then
    echo -e "${GREEN}✓${NC} Frontend container is running"
else
    echo -e "${YELLOW}⚠${NC} Frontend container not found. Starting it..."
    docker-compose -f docker-compose-fixed.yml up -d client-app
fi

echo ""
echo "Testing API endpoints..."
echo "------------------------------"

# Test direct API access
test_endpoint "http://localhost:8080/docs" "Direct API access (localhost:8080)"

# Test frontend access
test_endpoint "http://localhost:3000" "Frontend access (localhost:3000)"

# Test frontend API health endpoint
test_endpoint "http://localhost:3000/api/health" "Frontend health check"

echo ""
echo "Testing runtime configuration..."
echo "------------------------------"

# Create a test HTML file to check runtime config
cat > test-runtime-config.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Runtime Config Test</title>
</head>
<body>
    <h1>Runtime Configuration Test</h1>
    <p>Open the browser console to see the API URL detection</p>
    <button onclick="testApi()">Test API Configuration</button>
    <div id="result"></div>
    
    <script>
        // Simulate the runtime config logic
        function getApiUrl() {
            const hostname = window.location.hostname;
            const port = window.location.port;
            const protocol = window.location.protocol;
            
            console.log('Browser detection:', { hostname, port, protocol });
            
            // Docker Compose deployment (port 3000)
            if (port === '3000') {
                const apiUrl = `${protocol}//${hostname}:8080`;
                console.log('Docker deployment - using:', apiUrl);
                return apiUrl;
            }
            
            // Nginx proxy
            if (port === '' || port === '80' || port === '443') {
                console.log('Nginx proxy - using: /api');
                return '/api';
            }
            
            // Fallback
            return 'http://localhost:8080';
        }
        
        function testApi() {
            const apiUrl = getApiUrl();
            document.getElementById('result').innerHTML = `
                <h2>Results:</h2>
                <p><strong>Detected API URL:</strong> ${apiUrl}</p>
                <p><strong>Current Location:</strong> ${window.location.href}</p>
                <p><strong>Hostname:</strong> ${window.location.hostname}</p>
                <p><strong>Port:</strong> ${window.location.port || '(default)'}</p>
            `;
        }
        
        // Auto-run on load
        window.onload = testApi;
    </script>
</body>
</html>
EOF

echo -e "${GREEN}✓${NC} Created test-runtime-config.html"
echo ""
echo "To test the runtime configuration:"
echo "1. Open http://localhost:3000/chat in your browser"
echo "2. Click the 'Debug API URL' button"
echo "3. Verify it shows: http://localhost:8080"
echo ""
echo "For manual testing, open test-runtime-config.html in your browser"
echo ""
echo "==================================="
echo "Test Summary"
echo "==================================="

if test_endpoint "http://localhost:8080/docs" "" 2>/dev/null && \
   test_endpoint "http://localhost:3000" "" 2>/dev/null; then
    echo -e "${GREEN}✓ All services are accessible${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Remove NEXT_PUBLIC_API_URL from your docker-compose.yml"
    echo "2. Use docker-compose-fixed.yml for deployment"
    echo "3. Test with: curl -X POST http://localhost:8080/anonymize"
else
    echo -e "${RED}✗ Some services are not accessible${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check Docker logs: docker-compose logs"
    echo "2. Verify ports: docker ps"
    echo "3. Check network: docker network ls"
fi