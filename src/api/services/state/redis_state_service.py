import json
import logging
from presidio_anonymizer import OperatorResult
import redis

from services.state.state_service import StateService
from config.config import config

logger = logging.getLogger(__name__)


class RedisStateService(StateService):
    def __init__(self):
        logger.info("Initializing RedisStateService...")
        logger.info("Redis host: %s, port: %s, ssl: %s", 
                   config.Redis.hostname, config.Redis.port, config.Redis.ssl)
        
        try:
            self.redis = redis.Redis(
                host=config.Redis.hostname,
                port=config.Redis.port,
                db=0,
                password=config.Redis.key,
                ssl=config.Redis.ssl)
            
            # Test connection
            self.redis.ping()
            logger.info("Redis connection established successfully")
        except Exception as e:
            logger.error("Failed to connect to Redis: %s", str(e))
            raise

    def get_state(self, session_id):
        """Get the state for the given session_id"""

        logger.info("=== Getting state from Redis ===")
        logger.info("Session ID: %s", session_id)
        
        try:
            json_data = self.redis.get(session_id)
            if json_data is None:
                logger.info("No state found for session_id: %s", session_id)
                return None
            
            logger.info("Raw data retrieved from Redis, size: %d bytes", len(json_data))
            entity_mappings = json.loads(json_data)
            logger.info("State data parsed successfully")
            logger.info("Entity mappings keys: %s", list(entity_mappings.keys()) if entity_mappings else "None")
            logger.info("=== State retrieval completed successfully ===")
            return entity_mappings
        except json.JSONDecodeError as e:
            logger.error("Failed to parse JSON data for session_id %s: %s", session_id, str(e))
            raise
        except Exception as e:
            logger.exception("Error getting state for session_id %s: %s", session_id, str(e))
            raise

    def set_state(self, session_id, entity_mappings):
        """Set the state for the given session_id"""

        logger.info("=== Setting state in Redis ===")
        logger.info("Session ID: %s", session_id)
        logger.info("Entity mappings keys: %s", list(entity_mappings.keys()) if entity_mappings else "None")
        
        try:
            json_data = json.dumps(entity_mappings)
            logger.info("Data serialized to JSON, size: %d bytes", len(json_data))
            
            result = self.redis.set(session_id, json_data)
            if result:
                logger.info("State saved successfully to Redis")
                logger.info("Redis operation result: %s", result)
            else:
                logger.warning("Redis set operation returned False")
            
            logger.info("=== State save completed ===")
        except Exception as e:
            logger.exception("Error saving state for session_id %s: %s", session_id, str(e))
            raise
