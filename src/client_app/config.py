import os

class Config:
    # WebSocket settings
    WEBSOCKET_PING_INTERVAL = int(os.getenv('WEBSOCKET_PING_INTERVAL', '30'))
    WEBSOCKET_PING_TIMEOUT = int(os.getenv('WEBSOCKET_PING_TIMEOUT', '10'))
    
    # Server settings
    SERVER_TIMEOUT = int(os.getenv('SERVER_TIMEOUT', '60'))
    MAX_CONNECTIONS = int(os.getenv('MAX_CONNECTIONS', '100'))
    
    # Retry settings
    MAX_RETRIES = int(os.getenv('MAX_RETRIES', '3'))
    RETRY_DELAY = int(os.getenv('RETRY_DELAY', '1'))
