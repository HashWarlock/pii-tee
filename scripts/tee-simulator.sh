#!/bin/bash

# TEE Simulator Management Script
# Based on Phala Network dstack documentation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SIMULATOR_IMAGE="phalanetwork/dstack-simulator:latest"
CONTAINER_NAME="dstack-tee-simulator"
SIMULATOR_PORT="${TEE_SIMULATOR_PORT:-8090}"
SIMULATOR_HOST="${TEE_SIMULATOR_HOST:-localhost}"
DSTACK_SOCKET="/var/run/dstack.sock"

# Functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  dstack TEE Simulator Management${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
        echo "Please install Docker or run this script within Flox environment"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker daemon is not running${NC}"
        echo "Please start Docker and try again"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker is available${NC}"
}

pull_simulator() {
    echo -e "${YELLOW}📦 Pulling TEE simulator image...${NC}"
    docker pull $SIMULATOR_IMAGE || {
        echo -e "${YELLOW}⚠️  Could not pull official image, building local simulator...${NC}"
        build_local_simulator
    }
    echo -e "${GREEN}✅ Simulator image ready${NC}"
}

build_local_simulator() {
    echo -e "${YELLOW}🔨 Building local TEE simulator...${NC}"
    
    # Create temporary Dockerfile for simulator
    cat > /tmp/dstack-simulator.Dockerfile << 'EOF'
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    cryptography \
    pydantic

# Create simulator script
COPY simulator.py /app/

EXPOSE 8090

CMD ["uvicorn", "simulator:app", "--host", "0.0.0.0", "--port", "8090"]
EOF

    # Create simulator Python script
    cat > /tmp/simulator.py << 'EOF'
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
import base64
import json
import hashlib
import time
from typing import Optional, Dict, Any

app = FastAPI(title="dstack TEE Simulator")

# Store for keys
keys_store = {}

class AttestationRequest(BaseModel):
    report_data: str
    runtime_data: Optional[Dict[str, Any]] = None

class SignRequest(BaseModel):
    data: str
    key_id: Optional[str] = None

@app.get("/info")
async def get_info():
    return {
        "version": "1.0.0",
        "type": "simulator",
        "status": "running",
        "features": ["ecdsa", "attestation", "signing"],
        "timestamp": int(time.time())
    }

@app.post("/attestation/ecdsa/key")
async def generate_ecdsa_key():
    # Generate ECDSA key pair
    private_key = ec.generate_private_key(ec.SECP256K1(), default_backend())
    public_key = private_key.public_key()
    
    # Serialize public key
    public_key_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint
    )
    
    # Store key
    key_id = hashlib.sha256(public_key_bytes).hexdigest()[:16]
    keys_store[key_id] = private_key
    
    return {
        "key_id": key_id,
        "public_key": base64.b64encode(public_key_bytes).decode('utf-8'),
        "algorithm": "ECDSA-SECP256K1"
    }

@app.post("/attestation/generate")
async def generate_attestation(request: AttestationRequest):
    # Simulate TEE attestation
    report = {
        "report_data": request.report_data,
        "runtime_data": request.runtime_data or {},
        "enclave_id": "simulator-enclave-001",
        "timestamp": int(time.time()),
        "measurement": hashlib.sha256(request.report_data.encode()).hexdigest()
    }
    
    # Create simulated attestation
    attestation = base64.b64encode(json.dumps(report).encode()).decode('utf-8')
    
    return {
        "attestation": attestation,
        "quote_type": "simulated",
        "success": True
    }

@app.post("/sign")
async def sign_data(request: SignRequest):
    if request.key_id and request.key_id in keys_store:
        private_key = keys_store[request.key_id]
    else:
        # Generate new key if not specified
        private_key = ec.generate_private_key(ec.SECP256K1(), default_backend())
        public_key = private_key.public_key()
        public_key_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint
        )
        key_id = hashlib.sha256(public_key_bytes).hexdigest()[:16]
        keys_store[key_id] = private_key
    
    # Sign the data
    signature = private_key.sign(
        request.data.encode(),
        ec.ECDSA(hashes.SHA256())
    )
    
    return {
        "signature": base64.b64encode(signature).decode('utf-8'),
        "key_id": key_id if request.key_id else key_id,
        "algorithm": "ECDSA-SHA256"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": int(time.time())}

# Create mock socket file endpoint
@app.post("/socket/simulate")
async def simulate_socket():
    return {
        "message": "Socket simulation endpoint",
        "socket_path": "/var/run/dstack.sock",
        "simulated": True
    }
EOF

    # Build the Docker image
    docker build -f /tmp/dstack-simulator.Dockerfile -t $SIMULATOR_IMAGE /tmp/
    
    # Cleanup
    rm -f /tmp/dstack-simulator.Dockerfile /tmp/simulator.py
}

start_simulator() {
    echo -e "${YELLOW}🚀 Starting TEE simulator...${NC}"
    
    # Check if container already exists
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${YELLOW}Container already exists, removing old container...${NC}"
        docker rm -f $CONTAINER_NAME
    fi
    
    # Create a mock socket file if it doesn't exist
    if [ ! -e "$DSTACK_SOCKET" ]; then
        echo -e "${YELLOW}Creating mock dstack socket...${NC}"
        sudo mkdir -p $(dirname $DSTACK_SOCKET)
        sudo touch $DSTACK_SOCKET
    fi
    
    # Run the simulator
    docker run -d \
        --name $CONTAINER_NAME \
        -p ${SIMULATOR_PORT}:8090 \
        -v $DSTACK_SOCKET:$DSTACK_SOCKET \
        --restart unless-stopped \
        $SIMULATOR_IMAGE
    
    echo -e "${GREEN}✅ TEE simulator started on port ${SIMULATOR_PORT}${NC}"
    
    # Wait for simulator to be ready
    echo -e "${YELLOW}⏳ Waiting for simulator to be ready...${NC}"
    sleep 3
    
    # Verify it's running
    if verify_simulator; then
        echo -e "${GREEN}✅ TEE simulator is ready!${NC}"
        echo ""
        echo "Simulator endpoints available at:"
        echo "  - Info: http://${SIMULATOR_HOST}:${SIMULATOR_PORT}/info"
        echo "  - Generate Key: http://${SIMULATOR_HOST}:${SIMULATOR_PORT}/attestation/ecdsa/key"
        echo "  - Attestation: http://${SIMULATOR_HOST}:${SIMULATOR_PORT}/attestation/generate"
        echo "  - Sign: http://${SIMULATOR_HOST}:${SIMULATOR_PORT}/sign"
    else
        echo -e "${RED}❌ TEE simulator failed to start properly${NC}"
        exit 1
    fi
}

stop_simulator() {
    echo -e "${YELLOW}🛑 Stopping TEE simulator...${NC}"
    
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        docker stop $CONTAINER_NAME
        docker rm $CONTAINER_NAME
        echo -e "${GREEN}✅ TEE simulator stopped${NC}"
    else
        echo -e "${YELLOW}ℹ️  TEE simulator is not running${NC}"
    fi
}

restart_simulator() {
    stop_simulator
    start_simulator
}

status_simulator() {
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${GREEN}✅ TEE simulator is running${NC}"
        
        # Get container details
        echo ""
        echo "Container details:"
        docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Status}}\t{{.Ports}}"
        
        # Check API endpoint
        echo ""
        if verify_simulator; then
            echo -e "${GREEN}✅ API endpoint is responding${NC}"
        else
            echo -e "${YELLOW}⚠️  API endpoint is not responding${NC}"
        fi
    else
        echo -e "${RED}❌ TEE simulator is not running${NC}"
    fi
}

verify_simulator() {
    # Check if the /info endpoint responds
    if curl -s -f "http://${SIMULATOR_HOST}:${SIMULATOR_PORT}/info" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

test_simulator() {
    echo -e "${YELLOW}🧪 Testing TEE simulator...${NC}"
    echo ""
    
    # Test /info endpoint
    echo "1. Testing /info endpoint:"
    response=$(curl -s "http://${SIMULATOR_HOST}:${SIMULATOR_PORT}/info")
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ /info endpoint responding${NC}"
        echo "Response: $response"
    else
        echo -e "${RED}❌ Failed to connect to /info endpoint${NC}"
        exit 1
    fi
    echo ""
    
    # Test key generation
    echo "2. Testing ECDSA key generation:"
    key_response=$(curl -s -X POST "http://${SIMULATOR_HOST}:${SIMULATOR_PORT}/attestation/ecdsa/key")
    if [ $? -eq 0 ] && echo "$key_response" | grep -q "public_key"; then
        echo -e "${GREEN}✅ ECDSA key generation successful${NC}"
        echo "Response: ${key_response:0:100}..."
    else
        echo -e "${RED}❌ Failed to generate ECDSA key${NC}"
        exit 1
    fi
    echo ""
    
    # Test remote attestation
    echo "3. Testing remote attestation:"
    attestation_data='{"report_data": "test-data-123"}'
    attestation_response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$attestation_data" \
        "http://${SIMULATOR_HOST}:${SIMULATOR_PORT}/attestation/generate")
    
    if [ $? -eq 0 ] && echo "$attestation_response" | grep -q "attestation"; then
        echo -e "${GREEN}✅ Remote attestation generation successful${NC}"
        echo "Response: ${attestation_response:0:100}..."
    else
        echo -e "${RED}❌ Failed to generate remote attestation${NC}"
        exit 1
    fi
    echo ""
    
    echo -e "${GREEN}✅ All TEE simulator tests passed!${NC}"
}

logs_simulator() {
    echo -e "${YELLOW}📋 TEE simulator logs:${NC}"
    docker logs $CONTAINER_NAME --tail 50
}

integrate_flox() {
    echo -e "${YELLOW}🔧 Integrating TEE simulator with Flox environment...${NC}"
    
    # Update Flox manifest to include TEE simulator service
    cat >> .flox/env/manifest.toml << 'EOF'

# TEE Simulator Service
[services.tee-simulator]
command = "bash scripts/tee-simulator.sh start && tail -f /dev/null"
vars.TEE_SIMULATOR_URL = "http://localhost:8090"
vars.DSTACK_SIMULATOR_MODE = "true"
EOF
    
    echo -e "${GREEN}✅ TEE simulator integrated with Flox${NC}"
    echo ""
    echo "To use the simulator in Flox:"
    echo "  1. flox activate"
    echo "  2. flox services start tee-simulator"
    echo ""
}

# Main script
print_header

case "${1:-}" in
    start)
        check_docker
        pull_simulator
        start_simulator
        ;;
    stop)
        check_docker
        stop_simulator
        ;;
    restart)
        check_docker
        restart_simulator
        ;;
    status)
        check_docker
        status_simulator
        ;;
    test)
        check_docker
        test_simulator
        ;;
    logs)
        check_docker
        logs_simulator
        ;;
    integrate)
        integrate_flox
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|test|logs|integrate}"
        echo ""
        echo "Commands:"
        echo "  start     - Start the TEE simulator"
        echo "  stop      - Stop the TEE simulator"
        echo "  restart   - Restart the TEE simulator"
        echo "  status    - Check simulator status"
        echo "  test      - Run simulator tests"
        echo "  logs      - Show simulator logs"
        echo "  integrate - Integrate with Flox environment"
        exit 1
        ;;
esac