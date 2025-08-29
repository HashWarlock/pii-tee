"""Unit tests for main API endpoints."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)


class TestAnonymizeEndpoint:
    """Tests for /anonymize endpoint."""
    
    def test_anonymize_success(self):
        """Test successful anonymization."""
        response = client.post(
            "/anonymize",
            json={"text": "John Doe lives at john@example.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert "text" in data
        assert "signature" in data
        assert "public_key" in data
        assert "John Doe" not in data["text"]
        assert "john@example.com" not in data["text"]
    
    def test_anonymize_with_session_id(self):
        """Test anonymization with existing session ID."""
        # First request to create session
        response1 = client.post(
            "/anonymize",
            json={"text": "Alice"}
        )
        session_id = response1.json()["session_id"]
        
        # Second request with same session
        response2 = client.post(
            "/anonymize",
            json={
                "text": "Alice called Bob",
                "session_id": session_id
            }
        )
        assert response2.status_code == 200
        data = response2.json()
        assert data["session_id"] == session_id
        # Alice should have same replacement as first request
        assert "<PERSON_0>" in data["text"]
        assert "<PERSON_1>" in data["text"]  # Bob gets different number
    
    def test_anonymize_empty_text(self):
        """Test anonymization with empty text."""
        response = client.post(
            "/anonymize",
            json={"text": ""}
        )
        # Should fail validation due to min_length=1
        assert response.status_code == 422
    
    def test_anonymize_different_language(self):
        """Test anonymization with different language."""
        response = client.post(
            "/anonymize",
            json={
                "text": "Test text",
                "language": "es"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "text" in data


class TestDeanonymizeEndpoint:
    """Tests for /deanonymize endpoint."""
    
    def test_deanonymize_success(self):
        """Test successful deanonymization."""
        # First anonymize
        anon_response = client.post(
            "/anonymize",
            json={"text": "John Doe"}
        )
        anon_data = anon_response.json()
        session_id = anon_data["session_id"]
        anon_text = anon_data["text"]
        
        # Then deanonymize
        deanon_response = client.post(
            "/deanonymize",
            json={
                "text": anon_text,
                "session_id": session_id
            }
        )
        assert deanon_response.status_code == 200
        deanon_data = deanon_response.json()
        assert deanon_data["text"] == "John Doe"
        assert "signature" in deanon_data
        assert "public_key" in deanon_data
    
    def test_deanonymize_invalid_session(self):
        """Test deanonymization with invalid session ID."""
        response = client.post(
            "/deanonymize",
            json={
                "text": "<PERSON_0>",
                "session_id": "invalid-session-id"
            }
        )
        assert response.status_code == 404
        assert "session is not found" in response.json()["detail"]
    
    def test_deanonymize_empty_text(self):
        """Test deanonymization with empty text."""
        response = client.post(
            "/deanonymize",
            json={
                "text": "",
                "session_id": "some-session"
            }
        )
        # Should fail validation
        assert response.status_code == 422


class TestPublicKeyEndpoint:
    """Tests for /public-key endpoint."""
    
    def test_get_public_key_default(self):
        """Test getting default public key."""
        response = client.get("/public-key")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "public_key" in data["data"]
        assert "signing_method" in data["data"]
    
    def test_get_public_key_ecdsa(self):
        """Test getting ECDSA public key."""
        response = client.get("/public-key?signing_method=ecdsa")
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["signing_method"] == "ecdsa"
        # ECDSA public key should be Ethereum address
        assert data["data"]["public_key"].startswith("0x")
    
    def test_get_public_key_ed25519(self):
        """Test getting Ed25519 public key."""
        response = client.get("/public-key?signing_method=ed25519")
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["signing_method"] == "ed25519"
        # Ed25519 public key should be base64
        assert len(data["data"]["public_key"]) > 0


class TestVerifySignatureEndpoint:
    """Tests for /verify-signature endpoint."""
    
    def test_verify_valid_signature(self):
        """Test verification of valid signature."""
        # First get a signed message
        anon_response = client.post(
            "/anonymize",
            json={"text": "Test message"}
        )
        anon_data = anon_response.json()
        
        # Verify the signature
        verify_response = client.get(
            "/verify-signature",
            params={
                "content": anon_data["text"],
                "signature": anon_data["signature"],
                "public_key": anon_data["public_key"],
                "signing_method": anon_data["signing_method"]
            }
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["success"] == True
        assert verify_data["data"]["is_valid"] == True
    
    def test_verify_invalid_signature(self):
        """Test verification of invalid signature."""
        response = client.get(
            "/verify-signature",
            params={
                "content": "Test content",
                "signature": "invalid_signature",
                "public_key": "invalid_key",
                "signing_method": "ecdsa"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["is_valid"] == False
    
    def test_verify_missing_params(self):
        """Test verification with missing parameters."""
        response = client.get("/verify-signature")
        assert response.status_code == 422  # Validation error


class TestHealthEndpoint:
    """Tests for /health endpoint."""
    
    def test_health_check(self):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "timestamp" in data
        assert "services" in data
        assert data["services"]["api"] == "healthy"
        assert "version" in data


class TestOpenAPIEndpoints:
    """Tests for OpenAPI documentation endpoints."""
    
    def test_openapi_json(self):
        """Test OpenAPI JSON endpoint."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert data["info"]["title"] == "PII-TEE API"
        assert data["info"]["version"] == "1.0.0"
        assert "paths" in data
        assert "/anonymize" in data["paths"]
        assert "/deanonymize" in data["paths"]
    
    def test_docs_endpoint(self):
        """Test Swagger UI endpoint."""
        response = client.get("/docs")
        assert response.status_code == 200
        assert "swagger-ui" in response.text.lower()
    
    def test_redoc_endpoint(self):
        """Test ReDoc endpoint."""
        response = client.get("/redoc")
        assert response.status_code == 200
        assert "redoc" in response.text.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])