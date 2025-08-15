import json
import os
import logging
from typing import Dict, Optional, Tuple

import eth_utils
import web3
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from dstack_sdk import TappdClient
from eth_account.messages import encode_defunct

logger = logging.getLogger(__name__)

ED25519 = "ed25519"
ECDSA = "ecdsa"
SIGNING_METHOD = os.getenv("SIGNING_METHOD", ED25519)


class QuoteService:
    """
    Service for generating attestation quotes and signing content.
    """

    def __init__(self, signing_method: str = None):
        logger.info("Initializing QuoteService with signing_method: %s", signing_method)
        self.signing_method = signing_method or SIGNING_METHOD
        logger.info("Using signing method: %s", self.signing_method)
        
        self.signing_address = None
        self.intel_quote = None
        self.event_log = None
        self.info = None
        self.public_key = None

        self.raw_acct = None
        self.ed25519_key = None
        logger.info("QuoteService initialized successfully")

    def init(self, force: bool = False) -> Dict:
        """Initialize the quote object."""
        logger.info("=== Starting quote initialization ===")
        logger.info("Force flag: %s", force)
        logger.info("Current signing_address: %s", self.signing_address)
        
        if self.signing_address is not None and not force:
            logger.info("Quote already initialized, returning existing data")
            return self._get_quote_data()

        logger.info("Initializing new quote...")
        if self.signing_method == ED25519:
            logger.info("Initializing Ed25519...")
            self._init_ed25519()
        elif self.signing_method == ECDSA:
            logger.info("Initializing ECDSA...")
            self._init_ecdsa()
        else:
            logger.error("Unsupported signing method: %s", self.signing_method)
            raise ValueError("Unsupported signing method")

        logger.info("Getting Intel TDX quote...")
        self.intel_quote, self.event_log = self._get_quote(self.public_key)
        logger.info("Intel quote obtained, length: %d", len(self.intel_quote) if self.intel_quote else 0)
        logger.info("Event log obtained: %s", "Yes" if self.event_log else "No")

        logger.info("Getting Tappd info...")
        self.info = self._get_info()
        logger.info("Tappd info obtained: %s", "Yes" if self.info else "No")

        result = self._get_quote_data()
        logger.info("=== Quote initialization completed successfully ===")
        logger.info("Final result keys: %s", list(result.keys()))
        return result

    def get_public_key(self) -> Dict:
        """Get the public key for verification purposes."""
        logger.info("Getting public key...")
        if not self.public_key:
            logger.info("Public key not available, initializing quote service...")
            self.init()
        else:
            logger.info("Public key already available")
        
        result = {
            "public_key": self.public_key,
            "signing_method": self.signing_method,
            "signing_address": self.signing_address
        }
        logger.info("Public key retrieved successfully")
        logger.info("Public key length: %d characters", len(self.public_key) if self.public_key else 0)
        return result

    def sign_content(self, content: str) -> str:
        """Sign content using the configured signing method."""
        logger.info("=== Starting content signing ===")
        logger.info("Content length: %d characters", len(content))
        logger.info("Signing method: %s", self.signing_method)
        
        try:
            if self.signing_method == ED25519:
                logger.info("Signing with Ed25519...")
                signature = self._sign_ed25519(content)
            elif self.signing_method == ECDSA:
                logger.info("Signing with ECDSA...")
                signature = self._sign_ecdsa(content)
            else:
                logger.error("Unsupported signing method: %s", self.signing_method)
                raise ValueError("Unsupported signing method")
            
            logger.info("Content signed successfully")
            logger.info("Signature length: %d characters", len(signature))
            logger.info("=== Content signing completed successfully ===")
            return signature
        except Exception as e:
            logger.exception("Error during content signing: %s", str(e))
            raise

    def _get_quote_data(self) -> Dict:
        """Return the current quote data as a dictionary."""
        logger.debug("Getting quote data...")
        result = {
            "signing_address": self.signing_address,
            "public_key": self.public_key,
            "intel_quote": self.intel_quote,
            "event_log": self.event_log,
            "info": self.info,
            "signing_method": self.signing_method
        }
        logger.debug("Quote data retrieved, keys: %s", list(result.keys()))
        logger.debug("Quote data values: %s", result.values())
        return result

    def _init_ed25519(self):
        """Initialize Ed25519 key pair."""
        logger.info("Generating Ed25519 key pair...")
        self.ed25519_key = Ed25519PrivateKey.generate()
        logger.info("Ed25519 private key generated successfully")
        
        self.public_key_bytes = self.ed25519_key.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        self.public_key = self.public_key_bytes.hex()
        self.signing_address = self.public_key
        logger.info("Ed25519 public key generated: %s...", self.public_key[:16])
        logger.info("Ed25519 initialization completed")

    def _init_ecdsa(self):
        """Initialize ECDSA account."""
        logger.info("Creating ECDSA account...")
        w3 = web3.Web3()
        self.raw_acct = w3.eth.account.create()
        self.signing_address = self.raw_acct.address
        logger.info("ECDSA account created, address: %s", self.signing_address)
        
        self.public_key = eth_utils.keccak(
            self.raw_acct._key_obj.public_key.to_bytes()
        ).hex()
        logger.info("ECDSA public key generated: %s...", self.public_key[:16])
        logger.info("ECDSA initialization completed")

    def _get_quote(self, public_key: str) -> Tuple[str, Dict]:
        """Get Intel TDX quote."""
        logger.info("Getting Intel TDX quote for public key: %s...", public_key[:16])
        try:
            client = TappdClient()
            logger.info("TappdClient created successfully")
            
            result = client.tdx_quote(public_key)
            logger.info("TDX quote request completed")
            
            event_log = json.loads(result.event_log)
            logger.info("Event log parsed successfully")
            
            logger.info("Intel quote obtained successfully")
            return result.quote, event_log
        except Exception as e:
            logger.exception("Error getting Intel TDX quote: %s", str(e))
            raise

    def _get_info(self) -> Dict:
        """Get Tappd info."""
        logger.info("Getting Tappd info...")
        import http.client
        import socket

        data = json.dumps({"report_data": self.public_key})
        headers = {"Content-Type": "application/json"}
        logger.info("Prepared request data for Tappd info")
        
        try:
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
                logger.info("Connecting to Tappd socket...")
                sock.connect("/var/run/tappd.sock")
                logger.info("Connected to Tappd socket successfully")

                conn = http.client.HTTPConnection("localhost")
                conn.sock = sock
                logger.info("HTTP connection established")

                try:
                    logger.info("Sending Tappd info request...")
                    conn.request(
                        "POST", "/prpc/Tappd.Info?json", body=data, headers=headers
                    )
                    response = conn.getresponse().read().decode()
                    logger.info("Tappd info response received, length: %d characters", len(response))
                    
                    result = json.loads(response)
                    logger.info("Tappd info parsed successfully")
                    return result
                finally:
                    conn.close()
                    logger.info("HTTP connection closed")
        except Exception as e:
            logger.exception("Error getting Tappd info: %s", str(e))
            raise

    def _sign_ed25519(self, content: str) -> str:
        """Sign content using Ed25519."""
        logger.info("Signing content with Ed25519...")
        message_bytes = content.encode("utf-8")
        logger.info("Content encoded to bytes, length: %d bytes", len(message_bytes))
        
        signature = self.ed25519_key.sign(message_bytes)
        signature_hex = signature.hex()
        logger.info("Ed25519 signature generated successfully")
        return signature_hex

    def _sign_ecdsa(self, content: str) -> str:
        """Sign content using ECDSA."""
        logger.info("Signing content with ECDSA...")
        signed_message = self.raw_acct.sign_message(encode_defunct(text=content))
        signature = f"0x{signed_message.signature.hex()}"
        logger.info("ECDSA signature generated successfully")
        return signature
