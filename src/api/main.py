import logging
from fastapi import FastAPI, Depends, HTTPException, Body, Query
from pydantic import BaseModel
from typing import Any, Optional, Dict

from services.presidio.python_presidio_service import PythonPresidioService
from services.presidio.hybrid_presidio_service import HybridPresidioService
from services.presidio.http_presidio_service import HttpPresidioService
from services.toolkit_service import ToolkitService
from services.state.redis_state_service import RedisStateService
from services.quote.quote_service import QuoteService

app = FastAPI()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

logger.info("=== Starting PII API Application ===")

class AnonymizeRequest(BaseModel):
    text: str
    session_id: Optional[str] = None
    language: Optional[str] = "en"


class AnonymizeResponse(BaseModel):
    session_id: str
    text: str
    quote: Optional[str] = None
    signature: Optional[str] = None
    public_key: Optional[str] = None
    signing_method: Optional[str] = None


class DeanonymizeRequest(BaseModel):
    text: str
    session_id: str


class DeanonymizeResponse(BaseModel):
    text: str
    quote: Optional[str] = None
    signature: Optional[str] = None
    public_key: Optional[str] = None
    signing_method: Optional[str] = None


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
    return toolkit_service


@app.post("/anonymize", response_model=AnonymizeResponse)
async def anonymize_endpoint(
    request: AnonymizeRequest,
    toolkit_service: ToolkitService = Depends(get_toolkit_service)
) -> Any:
    """Anonymize the given text using Toolkit service"""

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

@app.post("/deanonymize", response_model=DeanonymizeResponse)
async def deanonymize_endpoint(
    request: DeanonymizeRequest,
    toolkit_service: ToolkitService = Depends(get_toolkit_service)
):
    """Deanonymize the given text using Toolkit service"""

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

@app.get("/public-key")
async def get_public_key(
    signing_method: Optional[str] = Query(None)
):
    """Get the public key for quote verification"""
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

@app.get("/verify-signature")
async def verify_signature(
    content: str = Query(...),
    signature: str = Query(...),
    public_key: str = Query(...),
    signing_method: str = Query(...)
):
    """Verify a signature for given content"""
    logger.info("=== Verify signature endpoint called ===")
    logger.info("Content length: %d characters", len(content))
    logger.info("Signature length: %d characters", len(signature))
    logger.info("Public key length: %d characters", len(public_key))
    logger.info("Signing method: %s", signing_method)
    
    try:
        # This would need to be implemented in the QuoteService
        # For now, return a placeholder response
        logger.info("Signature verification not yet implemented, returning placeholder")
        result = {
            "success": True,
            "data": {
                "is_valid": "verification_not_implemented",
                "message": "Signature verification endpoint created but not yet implemented"
            }
        }
        logger.info("=== Verify signature endpoint completed successfully ===")
        return result
    except Exception as e:
        logger.exception("Error verifying signature: %s", str(e))
        raise HTTPException(
            status_code=500, 
            detail=f"Error verifying signature: {str(e)}"
        )
