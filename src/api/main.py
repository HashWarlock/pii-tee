import logging
import os
from typing import Any, Optional, Dict, Union

from fastapi import FastAPI, Depends, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from services.presidio.python_presidio_service import PythonPresidioService
from services.presidio.hybrid_presidio_service import HybridPresidioService
from services.presidio.http_presidio_service import HttpPresidioService
from services.toolkit_service import ToolkitService
from services.state.redis_state_service import RedisStateService
from services.quote.quote_service import QuoteService

app = FastAPI(
    title="PII-TEE API",
    description="""
## Privacy-Preserving Text Anonymization API

This API provides secure text anonymization with Trusted Execution Environment (TEE) support.

### Features
- **PII Detection**: Automatically detects and anonymizes personal information
- **Session Management**: Maintains consistent anonymization within sessions
- **Reversible**: Can restore original text using session mappings
- **TEE Attestation**: Cryptographic proof of secure computation
- **Signature Verification**: All operations are cryptographically signed

### Security
- All text processing occurs within TEE enclaves when available
- Session data is encrypted and stored with TTL
- Supports both ECDSA and Ed25519 signatures
- No PII is logged or persisted beyond session lifetime
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "PII-TEE Support",
        "url": "https://github.com/HashWarlock/pii-tee",
        "email": "support@example.com"
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    }
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure specific origins in production via environment variable
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

logger.info("=== Starting PII API Application ===")

class AnonymizeRequest(BaseModel):
    """Request model for text anonymization."""
    text: str = Field(..., description="Text to anonymize", min_length=1)
    session_id: Optional[str] = Field(None, description="Session ID for consistent anonymization")
    language: Optional[str] = Field("en", description="Language code for text processing")


class AnonymizeResponse(BaseModel):
    """Response model for text anonymization."""
    session_id: str = Field(..., description="Session ID for this anonymization")
    text: str = Field(..., description="Anonymized text with PII replaced")
    quote: Optional[str] = Field(None, description="TEE attestation quote")
    signature: Optional[str] = Field(None, description="Cryptographic signature of the text")
    public_key: Optional[str] = Field(None, description="Public key for signature verification")
    signing_method: Optional[str] = Field(None, description="Signing algorithm used (ecdsa/ed25519)")


class DeanonymizeRequest(BaseModel):
    """Request model for text deanonymization."""
    text: str = Field(..., description="Anonymized text to restore", min_length=1)
    session_id: str = Field(..., description="Session ID with stored entity mappings")


class DeanonymizeResponse(BaseModel):
    """Response model for text deanonymization."""
    text: str = Field(..., description="Original text with PII restored")
    quote: Optional[str] = Field(None, description="TEE attestation quote")
    signature: Optional[str] = Field(None, description="Cryptographic signature of the text")
    public_key: Optional[str] = Field(None, description="Public key for signature verification")
    signing_method: Optional[str] = Field(None, description="Signing algorithm used")


logger.info("Initializing services...")
presidio_service = PythonPresidioService()
logger.info("Presidio service initialized: %s", type(presidio_service).__name__)

# presidio_service = HttpPresidioService()
# presidio_service = HybridPresidioService()

state_service = RedisStateService()
logger.info("State service initialized: %s", type(state_service).__name__)

toolkit_service = ToolkitService(presidio_service, state_service)
logger.info("Toolkit service initialized successfully")

logger.info("All services initialized successfully")
logger.info("=== PII API Application startup completed ===")

def get_toolkit_service() -> ToolkitService:
    """Dependency injection for toolkit service."""
    return toolkit_service


@app.post("/anonymize", response_model=AnonymizeResponse, tags=["Anonymization"], summary="Anonymize text")
async def anonymize_endpoint(
    request: AnonymizeRequest,
    toolkit_service: ToolkitService = Depends(get_toolkit_service)
) -> AnonymizeResponse:
    """
    Anonymize PII in the provided text.
    
    Args:
        request: The anonymization request containing text and optional session ID
        toolkit_service: Injected toolkit service for processing
    
    Returns:
        AnonymizeResponse with anonymized text and cryptographic signatures
    
    Raises:
        HTTPException: On processing errors
    """

    logger.info("=== Anonymize endpoint called ===")
    logger.info("Request text length: %d characters", len(request.text))
    logger.info("Request session_id: %s", request.session_id)
    logger.info("Request language: %s", request.language)

    try:
        logger.info("Calling toolkit service anonymize method...")
        result = toolkit_service.anonymize(
            text=request.text, session_id=request.session_id, language=request.language
        )
        logger.info("Toolkit service anonymize completed successfully")
        logger.info("Result session_id: %s", result.get("session_id"))
        logger.info("Result text length: %d characters", len(result.get("text", "")))
        logger.info("Result keys: %s", list(result.keys()))
        logger.info("=== Anonymize endpoint completed successfully ===")
        return result
    except Exception as e:
        logger.exception("Error during anonymization: %s", str(e))
        raise HTTPException(
            status_code=500, detail="An error occurred during anonymization"
        )

@app.post("/deanonymize", response_model=DeanonymizeResponse, tags=["Anonymization"], summary="Restore original text")
async def deanonymize_endpoint(
    request: DeanonymizeRequest,
    toolkit_service: ToolkitService = Depends(get_toolkit_service)
) -> DeanonymizeResponse:
    """
    Restore original PII in anonymized text.
    
    Args:
        request: The deanonymization request with anonymized text and session ID
        toolkit_service: Injected toolkit service for processing
    
    Returns:
        DeanonymizeResponse with original text restored
    
    Raises:
        HTTPException: 404 if session not found, 500 on processing errors
    """

    logger.info("=== Deanonymize endpoint called ===")
    logger.info("Request text length: %d characters", len(request.text))
    logger.info("Request session_id: %s", request.session_id)

    try:
        logger.info("Calling toolkit service deanonymize method...")
        result = toolkit_service.deanonymize(text=request.text, session_id=request.session_id)
        logger.info("Toolkit service deanonymize completed successfully")
        logger.info("Result text length: %d characters", len(result.get("text", "")))
        logger.info("Result keys: %s", list(result.keys()))
        logger.info("=== Deanonymize endpoint completed successfully ===")
        return result
    except ValueError as ve:
        logger.error("Deanonymization value error: %s", str(ve))
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.exception("Error during deanonymization: %s", str(e))
        raise HTTPException(
            status_code=500, detail="An error occurred during deanonymization"
        )

@app.get("/public-key", tags=["Security"], summary="Get public key")
async def get_public_key(
    signing_method: Optional[str] = Query(None, description="Signing method (ecdsa/ed25519)")
) -> Dict[str, Any]:
    """
    Get the public key for signature verification.
    
    Args:
        signing_method: Optional signing method to get specific key
    
    Returns:
        Dictionary containing public key and signing method
    
    Raises:
        HTTPException: On initialization errors
    """
    logger.info("=== Public key endpoint called ===")
    logger.info("Requested signing method: %s", signing_method)
    
    try:
        logger.info("Creating QuoteService...")
        service = QuoteService(signing_method=signing_method)
        logger.info("QuoteService created successfully")
        
        logger.info("Getting public key...")
        public_key_data = service.get_public_key()
        logger.info("Public key retrieved successfully")
        logger.info("Public key data keys: %s", list(public_key_data.keys()))
        logger.info("=== Public key endpoint completed successfully ===")
        return {"success": True, "data": public_key_data}
    except Exception as e:
        logger.exception("Error getting public key: %s", str(e))
        raise HTTPException(
            status_code=500, 
            detail=f"Error getting public key: {str(e)}"
        )

@app.get("/verify-signature", tags=["Security"], summary="Verify signature")
async def verify_signature(
    content: str = Query(..., description="Content that was signed"),
    signature: str = Query(..., description="Signature to verify"),
    public_key: str = Query(..., description="Public key for verification"),
    signing_method: str = Query(..., description="Signing method used (ecdsa/ed25519)")
) -> Dict[str, Any]:
    """
    Verify a cryptographic signature.
    
    Args:
        content: The original content that was signed
        signature: The signature to verify
        public_key: The public key to verify against
        signing_method: The signing algorithm used
    
    Returns:
        Dictionary with verification result
    
    Raises:
        HTTPException: On verification errors
    """
    logger.info("=== Verify signature endpoint called ===")
    logger.info("Content length: %d characters", len(content))
    logger.info("Signature length: %d characters", len(signature))
    logger.info("Public key length: %d characters", len(public_key))
    logger.info("Signing method: %s", signing_method)
    
    try:
        # Create a QuoteService instance with the correct signing method
        quote_service = QuoteService(signing_method=signing_method)
        
        # Perform the actual verification
        is_valid = quote_service.verify_signature(
            content=content,
            signature=signature,
            public_key=public_key
        )
        
        logger.info("Signature verification result: %s", is_valid)
        
        result = {
            "success": True,
            "data": {
                "is_valid": is_valid,
                "message": "Signature verified successfully" if is_valid else "Signature verification failed"
            }
        }
        logger.info("=== Verify signature endpoint completed successfully ===")
        return result
    except Exception as e:
        logger.exception("Error verifying signature: %s", str(e))
        # Return failed verification instead of error for better UX
        return {
            "success": True,
            "data": {
                "is_valid": False,
                "message": f"Verification failed: {str(e)}"
            }
        }

@app.get("/health", tags=["Monitoring"], summary="Health check")
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint for monitoring.
    
    Returns:
        Dictionary with service health status
    """
    from datetime import datetime
    
    try:
        # Check Redis connectivity
        redis_healthy = state_service.check_health() if hasattr(state_service, 'check_health') else True
        
        # Check Presidio service
        presidio_healthy = True
        try:
            # Quick test to ensure Presidio is working
            test_result = presidio_service.anonymize_text(
                "test-health", 
                "Test", 
                "en",
                {}
            )
            presidio_healthy = test_result is not None
        except Exception:
            presidio_healthy = False
        
        # Overall health
        is_healthy = redis_healthy and presidio_healthy
        
        return {
            "status": "healthy" if is_healthy else "degraded",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "redis": "healthy" if redis_healthy else "unhealthy",
                "presidio": "healthy" if presidio_healthy else "unhealthy",
                "api": "healthy"
            },
            "version": "1.0.0"
        }
    except Exception as e:
        logger.exception("Health check failed: %s", str(e))
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }
