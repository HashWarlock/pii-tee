import json
import os
import logging
from typing import Dict, Optional, Tuple
import base64

import eth_utils
import web3
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidSignature
from dstack_sdk import TappdClient
from eth_account.messages import encode_defunct
from eth_account import Account

logger = logging.getLogger(__name__)

ED25519 = "ed25519"
ECDSA = "ecdsa"
SIGNING_METHOD = os.getenv("SIGNING_METHOD", ECDSA)  # Default to ECDSA


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
        # Store public key as base64 for easier transmission and verification
        self.public_key = base64.b64encode(self.public_key_bytes).decode('utf-8')
        self.signing_address = self.public_key_bytes.hex()
        logger.info("Ed25519 public key (base64): %s...", self.public_key[:16])
        logger.info("Ed25519 signing address (hex): %s...", self.signing_address[:16])
        logger.info("Ed25519 initialization completed")

    def _init_ecdsa(self):
        """Initialize ECDSA account."""
        logger.info("Creating ECDSA account...")
        w3 = web3.Web3()
        self.raw_acct = w3.eth.account.create()
        self.signing_address = self.raw_acct.address
        logger.info("ECDSA account created, address: %s", self.signing_address)
        
        # For ECDSA, the "public key" for verification is actually the address
        # since we use recover_message to verify signatures
        self.public_key = self.signing_address
        logger.info("ECDSA public key (address): %s", self.public_key)
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
        except FileNotFoundError as e:
            # In development mode without TEE, return mock data
            logger.warning("TEE socket not available (development mode): %s", str(e))
            logger.info("Returning mock quote data for development")
            mock_quote = "MOCK_QUOTE_" + base64.b64encode(public_key.encode()).decode()[:32]
            mock_event_log = {"type": "mock", "timestamp": "development"}
            return mock_quote, mock_event_log
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
        except (FileNotFoundError, socket.error) as e:
            # In development mode without TEE, return mock data
            logger.warning("Tappd socket not available (development mode): %s", str(e))
            logger.info("Returning mock Tappd info for development")
            return {
                "type": "mock",
                "version": "development",
                "public_key": self.public_key
            }
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

    def verify_signature(self, content: str, signature: str, public_key: str) -> bool:
        """Verify a signature for given content using the appropriate method."""
        logger.info("=== Starting signature verification ===")
        logger.info("Signing method: %s", self.signing_method)
        logger.info("Content length: %d", len(content))
        logger.info("Signature length: %d", len(signature))
        logger.info("Public key length: %d", len(public_key))
        
        try:
            if self.signing_method == ED25519:
                return self._verify_ed25519(content, signature, public_key)
            elif self.signing_method == ECDSA:
                return self._verify_ecdsa(content, signature, public_key)
            else:
                logger.error("Unsupported signing method for verification: %s", self.signing_method)
                return False
        except Exception as e:
            logger.exception("Error during signature verification: %s", str(e))
            return False

    def _verify_ed25519(self, content: str, signature: str, public_key_str: str) -> bool:
        """Verify Ed25519 signature."""
        logger.info("Verifying Ed25519 signature...")
        logger.info("Public key (first 20 chars): %s...", public_key_str[:20])
        logger.info("Signature (first 20 chars): %s...", signature[:20])
        
        try:
            # Public key is already in base64 format from init
            public_key_bytes = base64.b64decode(public_key_str)
            logger.info("Public key decoded, bytes length: %d", len(public_key_bytes))
            
            # Create public key object
            public_key = Ed25519PublicKey.from_public_bytes(public_key_bytes)
            
            # Convert signature from hex to bytes
            signature_bytes = bytes.fromhex(signature)
            logger.info("Signature converted to bytes, length: %d", len(signature_bytes))
            
            # Verify the signature
            message_bytes = content.encode("utf-8")
            public_key.verify(signature_bytes, message_bytes)
            
            logger.info("Ed25519 signature verification successful")
            return True
            
        except InvalidSignature:
            logger.warning("Ed25519 signature verification failed: Invalid signature")
            return False
        except Exception as e:
            logger.exception("Error verifying Ed25519 signature: %s", str(e))
            return False

    def _verify_ecdsa(self, content: str, signature: str, public_key_str: str) -> bool:
        """Verify ECDSA signature."""
        logger.info("Verifying ECDSA signature...")
        logger.info("Public key (address): %s", public_key_str)
        logger.info("Signature: %s...", signature[:20] if len(signature) > 20 else signature)
        
        try:
            # Recover the address from the signature
            message = encode_defunct(text=content)
            
            # Remove '0x' prefix if present from signature
            if signature.startswith('0x'):
                signature = signature[2:]
            
            # Convert signature to bytes
            signature_bytes = bytes.fromhex(signature)
            logger.info("Signature bytes length: %d", len(signature_bytes))
            
            # Recover the signer's address
            recovered_address = Account.recover_message(message, signature=signature_bytes)
            logger.info("Recovered address: %s", recovered_address)
            
            # For ECDSA, public_key_str is the Ethereum address
            # Normalize both addresses for comparison (case-insensitive)
            recovered_normalized = recovered_address.lower()
            expected_normalized = public_key_str.lower()
            
            is_valid = recovered_normalized == expected_normalized
            logger.info("ECDSA verification result: %s", is_valid)
            logger.info("  Recovered: %s", recovered_normalized)
            logger.info("  Expected:  %s", expected_normalized)
            
            return is_valid
            
        except Exception as e:
            logger.exception("Error verifying ECDSA signature: %s", str(e))
            return False
