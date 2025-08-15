import logging
import uuid
from typing import Optional, Dict

from services.state.state_service import StateService
from services.presidio.presidio_service import PresidioService
from services.quote.quote_service import QuoteService

logger = logging.getLogger(__name__)


class ToolkitService:
    def __init__(self, presidio_service: PresidioService, state_service: StateService):
        logger.info("Initializing ToolkitService with presidio_service=%s, state_service=%s", 
                   type(presidio_service).__name__, type(state_service).__name__)
        self.presidio_service = presidio_service
        self.state_service = state_service

    def anonymize(self, text: str, session_id: Optional[str] = None, 
                  language: Optional[str] = "en") -> Dict:
        """Anonymize the given text using Presidio service with quote and signature"""

        logger.info("=== Starting anonymize operation ===")
        logger.info("Input text length: %d characters", len(text))
        logger.info("Input session_id: %s", session_id)
        logger.info("Input language: %s", language)

        entity_mappings = None
        if not session_id:
            logger.info("Anonymize called without session_id")
            session_id = str(uuid.uuid4())
            logger.info("Generated new session_id: %s", session_id)
        else:
            logger.info("Anonymize called with existing session_id: %s", session_id)
            entity_mappings = self.state_service.get_state(session_id)
            logger.info("Retrieved entity_mappings for session: %s", entity_mappings)

        try:
            logger.info("Calling presidio_service.anonymize_text...")
            # Perform anonymization
            anonymized_text, new_entity_mappings = self.presidio_service.anonymize_text(
                session_id, text, language, entity_mappings
            )
            logger.info("Presidio anonymization completed successfully")
            logger.info("Anonymized text length: %d characters", len(anonymized_text))
            logger.info("New entity mappings: %s", new_entity_mappings)
            
            # Save the state in the state service
            logger.info("Saving state to state service...")
            self.state_service.set_state(session_id, new_entity_mappings)
            logger.info("State saved successfully")

            # Generate quote and signature
            logger.info("Generating quote and signature...")
            quote_data = self._generate_quote_and_signature(anonymized_text, session_id)
            logger.info("Quote and signature generation completed")

            # Return enhanced response
            response = {
                "session_id": session_id,
                "text": anonymized_text,
                "quote": quote_data.get("quote"),
                "signature": quote_data.get("signature"),
                "public_key": quote_data.get("public_key"),
                "signing_method": quote_data.get("signing_method")
            }
            logger.info("=== Anonymize operation completed successfully ===")
            logger.info("Final response keys: %s", list(response.keys()))
            return response
        except Exception as e:
            logger.exception("Error during anonymization for session_id %s: %s", session_id, str(e))
            raise e

    def deanonymize(self, text: str, session_id: str) -> Dict:
        """Deanonymize the given text using Presidio service with quote and signature"""

        logger.info("=== Starting deanonymize operation ===")
        logger.info("Input text length: %d characters", len(text))
        logger.info("Input session_id: %s", session_id)

        entity_mappings = self.state_service.get_state(session_id)
        if entity_mappings is None:
            logger.error("No entity mappings found for session_id: %s", session_id)
            raise ValueError("Deanonymization is not possible because the session is not found")

        logger.info("Retrieved entity_mappings for session: %s", entity_mappings)

        try:
            logger.info("Calling presidio_service.deanonymize_text...")
            # Perform deanonymization
            deanonymized_text = self.presidio_service.deanonymize_text(
                session_id, text, entity_mappings
            )
            logger.info("Presidio deanonymization completed successfully")
            logger.info("Deanonymized text length: %d characters", len(deanonymized_text))

            # Generate quote and signature
            logger.info("Generating quote and signature...")
            quote_data = self._generate_quote_and_signature(deanonymized_text, session_id)
            logger.info("Quote and signature generation completed")
            logger.info("Quote data: %s", quote_data)

            # Return enhanced response
            response = {
                "text": deanonymized_text,
                "quote": quote_data.get("quote"),
                "signature": quote_data.get("signature"),
                "public_key": quote_data.get("public_key"),
                "signing_method": quote_data.get("signing_method")
            }
            logger.info("=== Deanonymize operation completed successfully ===")
            logger.info("Final response keys: %s", list(response.keys()))
            logger.info("Final response values: %s", response.values())
            return response
        except Exception as e:
            logger.exception("Error during deanonymization for session_id %s: %s", session_id, str(e))
            raise e

    def _generate_quote_and_signature(self, content: str, session_id: str) -> Dict:
        """Generate quote and sign the content for a session."""
        logger.info("Starting quote and signature generation for session: %s", session_id)
        logger.info("Content to sign length: %d characters", len(content))
        
        try:
            # Create quote service and generate quote
            logger.info("Creating QuoteService...")
            quote_service = QuoteService()
            logger.info("Initializing quote service...")
            quote_data = quote_service.init()
            logger.info("Quote service initialized successfully")
            logger.info("Quote data keys: %s", list(quote_data.keys()) if quote_data else "None")
            
            # Sign the content
            logger.info("Signing content...")
            signature = quote_service.sign_content(content)
            logger.info("Content signed successfully, signature length: %d characters", len(signature))
            
            result = {
                "quote": quote_data.get("intel_quote"),
                "signature": signature,
                "public_key": quote_data.get("public_key"),
                "signing_method": quote_data.get("signing_method")
            }
            logger.info("Result keys: %s", list(result.keys()))
            logger.info("Quote and signature generation completed successfully")
            return result
        except Exception as e:
            logger.warning("Could not generate quote/signature for session %s: %s", session_id, str(e))
            # Return empty quote data if generation fails
            fallback_result = {
                "quote": None,
                "signature": None,
                "public_key": None,
                "signing_method": None
            }
            logger.info("Returning fallback result due to quote generation failure")
            return fallback_result
