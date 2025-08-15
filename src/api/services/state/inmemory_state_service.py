import logging

from api.services.state.state_service import StateService

logger = logging.getLogger(__name__)

class InMemoryStateService(StateService):
    def __init__(self):
        logger.info("Initializing InMemoryStateService...")
        self.store = {}
        logger.info("In-memory store initialized successfully")

    def get_state(self, session_id):
        """Get the state for the given session_id"""

        logger.info("=== Getting state from in-memory store ===")
        logger.info("Session ID: %s", session_id)
        logger.info("Current store size: %d sessions", len(self.store))
        
        entity_mappings = self.store.get(session_id)
        if entity_mappings is None:
            logger.info("No state found for session_id: %s", session_id)
            logger.info("Available session IDs: %s", list(self.store.keys()))
            return None
        
        logger.info("State found for session_id: %s", session_id)
        logger.info("Entity mappings keys: %s", list(entity_mappings.keys()) if entity_mappings else "None")
        logger.info("=== State retrieval completed successfully ===")
        return entity_mappings

    def set_state(self, session_id, entity_mappings):
        """Set the state for the given session_id"""
        
        logger.info("=== Setting state in in-memory store ===")
        logger.info("Session ID: %s", session_id)
        logger.info("Entity mappings keys: %s", list(entity_mappings.keys()) if entity_mappings else "None")
        logger.info("Previous store size: %d sessions", len(self.store))
        
        self.store[session_id] = entity_mappings
        
        logger.info("State saved successfully")
        logger.info("New store size: %d sessions", len(self.store))
        logger.info("=== State save completed ===")
