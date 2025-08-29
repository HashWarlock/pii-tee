#!/usr/bin/env python3
"""
Fallback Python TEE Simulator for testing
Provides mock TEE functionality when the Rust simulator cannot be built
"""

import asyncio
import base64
import hashlib
import json
import os
import signal
import socket
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

# Simple in-memory key store
keys_store: Dict[str, bytes] = {}

def generate_mock_key() -> tuple[str, str]:
    """Generate a mock ECDSA key pair"""
    # This is a mock - in production, use proper cryptography
    timestamp = str(time.time()).encode()
    private_key = hashlib.sha256(timestamp).hexdigest()
    public_key = hashlib.sha256(private_key.encode()).hexdigest()
    
    key_id = hashlib.sha256(public_key.encode()).hexdigest()[:16]
    keys_store[key_id] = private_key.encode()
    
    return key_id, public_key

def generate_mock_attestation(report_data: str) -> str:
    """Generate a mock TEE attestation"""
    report = {
        "report_data": report_data,
        "enclave_id": "python-simulator-001",
        "timestamp": int(time.time()),
        "measurement": hashlib.sha256(report_data.encode()).hexdigest(),
        "simulator": True
    }
    return base64.b64encode(json.dumps(report).encode()).decode('utf-8')

def sign_data(data: str, key_id: Optional[str] = None) -> tuple[str, str]:
    """Mock signing of data"""
    if key_id and key_id in keys_store:
        private_key = keys_store[key_id]
    else:
        key_id, _ = generate_mock_key()
        private_key = keys_store[key_id]
    
    # Mock signature (in production, use proper ECDSA)
    signature_data = hashlib.sha256(data.encode() + private_key).hexdigest()
    signature = base64.b64encode(signature_data.encode()).decode('utf-8')
    
    return signature, key_id

async def handle_request(data: bytes) -> bytes:
    """Handle incoming socket requests"""
    try:
        # Parse the request
        request = json.loads(data.decode('utf-8'))
        command = request.get('command', '')
        
        if command == 'generate_key':
            key_id, public_key = generate_mock_key()
            response = {
                "success": True,
                "key_id": key_id,
                "public_key": public_key,
                "algorithm": "MOCK-ECDSA"
            }
        
        elif command == 'generate_attestation':
            report_data = request.get('report_data', '')
            attestation = generate_mock_attestation(report_data)
            response = {
                "success": True,
                "attestation": attestation,
                "quote_type": "python-simulated"
            }
        
        elif command == 'sign':
            data = request.get('data', '')
            key_id = request.get('key_id')
            signature, used_key_id = sign_data(data, key_id)
            response = {
                "success": True,
                "signature": signature,
                "key_id": used_key_id,
                "algorithm": "MOCK-SHA256"
            }
        
        elif command == 'info':
            response = {
                "success": True,
                "version": "1.0.0",
                "type": "python-simulator",
                "status": "running",
                "features": ["mock-ecdsa", "mock-attestation", "mock-signing"],
                "timestamp": int(time.time())
            }
        
        else:
            response = {
                "success": False,
                "error": f"Unknown command: {command}"
            }
        
        return json.dumps(response).encode('utf-8')
    
    except Exception as e:
        error_response = {
            "success": False,
            "error": str(e)
        }
        return json.dumps(error_response).encode('utf-8')

async def handle_client(reader, writer):
    """Handle socket client connection"""
    try:
        data = await reader.read(4096)
        if data:
            response = await handle_request(data)
            writer.write(response)
            await writer.drain()
    except Exception as e:
        print(f"Error handling client: {e}")
    finally:
        writer.close()
        await writer.wait_closed()

async def run_socket_server(socket_path: str):
    """Run Unix domain socket server"""
    # Remove existing socket file
    if os.path.exists(socket_path):
        os.remove(socket_path)
    
    # Create socket directory if it doesn't exist
    socket_dir = os.path.dirname(socket_path)
    os.makedirs(socket_dir, exist_ok=True)
    
    print(f"Starting Python TEE simulator on {socket_path}")
    
    server = await asyncio.start_unix_server(
        handle_client,
        path=socket_path
    )
    
    # Write PID file
    pid_file = os.path.join(socket_dir, "simulator.pid")
    with open(pid_file, 'w') as f:
        f.write(str(os.getpid()))
    
    print(f"Python TEE simulator running (PID: {os.getpid()})")
    print(f"Socket: {socket_path}")
    print("Press Ctrl+C to stop")
    
    async with server:
        await server.serve_forever()

def main():
    # Determine socket path
    project_root = Path(__file__).parent.parent
    socket_dir = project_root / ".dstack" / "sdk" / "simulator"
    socket_path = socket_dir / "tappd.sock"
    
    # Create directories
    socket_dir.mkdir(parents=True, exist_ok=True)
    
    # Set up signal handlers
    def signal_handler(signum, frame):
        print("\nShutting down Python TEE simulator...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run the server
    try:
        asyncio.run(run_socket_server(str(socket_path)))
    except KeyboardInterrupt:
        print("\nSimulator stopped by user")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()