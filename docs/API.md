# API Reference

## Base URL

- **Development**: `http://localhost:8080`
- **Production**: `https://<app-id>.<phala-cloud-server>-8080/api`

## Authentication

Currently, the API does not require authentication. In production, implement:
- API key authentication
- JWT tokens for session management
- Rate limiting per client

## Endpoints

### Anonymization

#### POST /anonymize

Anonymizes text by replacing PII with placeholder tokens.

**Request:**

```http
POST /anonymize
Content-Type: application/json

{
  "text": "John Doe lives at john@example.com and his phone is 555-1234",
  "session_id": "550bc0ce-16a6-4fe5-827b-1c930ba3b09c",  // Optional
  "language": "en"  // Optional, default: "en"
}
```

**Response:**

```json
{
  "session_id": "550bc0ce-16a6-4fe5-827b-1c930ba3b09c",
  "text": "<PERSON_0> lives at <EMAIL_ADDRESS_0> and his phone is <PHONE_NUMBER_0>",
  "quote": "0400020081000000...",  // TEE attestation quote (hex)
  "signature": "0x1c75ea3eea90ec4f...",  // Cryptographic signature
  "public_key": "0x19EF1DF9d8A3437D771Befa2edA90fc63480a76d",  // Signer's public key
  "signing_method": "ecdsa"  // or "ed25519"
}
```

**Status Codes:**
- `200 OK`: Successfully anonymized
- `400 Bad Request`: Invalid input
- `500 Internal Server Error`: Processing error

**Supported PII Types:**
- `PERSON`: Names of people
- `EMAIL_ADDRESS`: Email addresses
- `PHONE_NUMBER`: Phone numbers
- `LOCATION`: Geographic locations
- `CREDIT_CARD`: Credit card numbers
- `IP_ADDRESS`: IP addresses
- `URL`: Web URLs
- `DATE_TIME`: Dates and times
- `NRP`: Nationalities, religions, political groups
- `MEDICAL_LICENSE`: Medical license numbers
- `CRYPTO`: Cryptocurrency addresses

### Deanonymization

#### POST /deanonymize

Reverses anonymization using session-stored mappings.

**Request:**

```http
POST /deanonymize
Content-Type: application/json

{
  "text": "<PERSON_0> lives at <EMAIL_ADDRESS_0>",
  "session_id": "550bc0ce-16a6-4fe5-827b-1c930ba3b09c"  // Required
}
```

**Response:**

```json
{
  "text": "John Doe lives at john@example.com",
  "quote": "MOCK_QUOTE_...",  // TEE attestation quote
  "signature": "0x2bafd395d69ffeaf...",  // Cryptographic signature
  "public_key": "0xCDa88eE196453F2e5d618d4864056525A109Fd54",
  "signing_method": "ecdsa"
}
```

**Status Codes:**
- `200 OK`: Successfully deanonymized
- `400 Bad Request`: Missing session_id
- `404 Not Found`: Session not found
- `500 Internal Server Error`: Processing error

### Signature Verification

#### GET /verify-signature

Verifies a cryptographic signature for given content.

**Request:**

```http
GET /verify-signature?content=<text>&signature=<sig>&public_key=<key>&signing_method=<method>
```

**Query Parameters:**
- `content` (required): The text that was signed
- `signature` (required): The signature to verify
- `public_key` (required): Public key of the signer
- `signing_method` (required): Either "ecdsa" or "ed25519"

**Example:**

```bash
curl -G "http://localhost:8080/verify-signature" \
  --data-urlencode "content=Hello World" \
  --data-urlencode "signature=0x1c75ea3eea90ec4f..." \
  --data-urlencode "public_key=0x19EF1DF9d8A3437D771Be..." \
  --data-urlencode "signing_method=ecdsa"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "is_valid": true,
    "message": "Signature verified successfully"
  }
}
```

**Status Codes:**
- `200 OK`: Verification completed (check `is_valid`)
- `400 Bad Request`: Missing parameters
- `500 Internal Server Error`: Verification error

### Public Key

#### GET /public-key

Retrieves the current public key for signature verification.

**Request:**

```http
GET /public-key
```

**Response:**

```json
{
  "success": true,
  "data": {
    "public_key": "0x19EF1DF9d8A3437D771Befa2edA90fc63480a76d",
    "signing_method": "ecdsa",
    "signing_address": "0x19EF1DF9d8A3437D771Befa2edA90fc63480a76d"
  }
}
```

## Data Formats

### Session IDs

Session IDs are UUIDs that maintain state across operations:
- Format: `550bc0ce-16a6-4fe5-827b-1c930ba3b09c`
- Generated automatically if not provided
- Required for deanonymization
- Expire after configured TTL (default: 1 hour)

### Signing Methods

#### ECDSA (Default)
- **Public Key Format**: Ethereum address (0x-prefixed hex)
- **Signature Format**: 0x-prefixed hex string
- **Example Public Key**: `0x19EF1DF9d8A3437D771Befa2edA90fc63480a76d`
- **Use Case**: Web3 compatibility, Ethereum integration

#### Ed25519
- **Public Key Format**: Base64-encoded string
- **Signature Format**: Hex string (no 0x prefix)
- **Example Public Key**: `YAQtwVQBsN4YEx+x9wW+6IcNvFjqRukYoGU8iEzs6Zc=`
- **Use Case**: High-performance, smaller signatures

### TEE Quotes

TEE (Trusted Execution Environment) quotes provide attestation:
- **Format**: Hex-encoded binary data
- **Production**: Real Intel SGX/TDX attestation
- **Development**: Mock quotes for testing
- **Size**: Typically 2-4 KB when encoded

## Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional context
    }
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Request validation failed |
| `SESSION_NOT_FOUND` | Session ID doesn't exist |
| `ANONYMIZATION_FAILED` | PII detection/replacement failed |
| `SIGNATURE_GENERATION_FAILED` | Could not generate signature |
| `VERIFICATION_FAILED` | Signature verification failed |
| `TEE_UNAVAILABLE` | TEE hardware not available |
| `REDIS_ERROR` | Session storage error |

## Rate Limiting

Recommended rate limits for production:

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| `/anonymize` | 100 requests | 1 minute |
| `/deanonymize` | 100 requests | 1 minute |
| `/verify-signature` | 1000 requests | 1 minute |
| `/public-key` | 100 requests | 1 minute |

## Examples

### Python Client

```python
import requests
import json

class PIITEEClient:
    def __init__(self, base_url="http://localhost:8080"):
        self.base_url = base_url
        self.session_id = None
    
    def anonymize(self, text):
        response = requests.post(
            f"{self.base_url}/anonymize",
            json={"text": text, "session_id": self.session_id}
        )
        data = response.json()
        self.session_id = data["session_id"]
        return data
    
    def deanonymize(self, text):
        response = requests.post(
            f"{self.base_url}/deanonymize",
            json={"text": text, "session_id": self.session_id}
        )
        return response.json()
    
    def verify_signature(self, content, signature, public_key, method="ecdsa"):
        response = requests.get(
            f"{self.base_url}/verify-signature",
            params={
                "content": content,
                "signature": signature,
                "public_key": public_key,
                "signing_method": method
            }
        )
        return response.json()

# Usage
client = PIITEEClient()

# Anonymize
result = client.anonymize("John Doe's email is john@example.com")
print(f"Anonymized: {result['text']}")
print(f"Signature: {result['signature'][:20]}...")

# Verify
verification = client.verify_signature(
    result['text'],
    result['signature'],
    result['public_key'],
    result['signing_method']
)
print(f"Valid: {verification['data']['is_valid']}")

# Deanonymize
original = client.deanonymize(result['text'])
print(f"Original: {original['text']}")
```

### JavaScript/TypeScript Client

```typescript
class PIITEEClient {
  private baseUrl: string;
  private sessionId?: string;

  constructor(baseUrl = "http://localhost:8080") {
    this.baseUrl = baseUrl;
  }

  async anonymize(text: string): Promise<AnonymizeResponse> {
    const response = await fetch(`${this.baseUrl}/anonymize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        session_id: this.sessionId
      })
    });
    
    const data = await response.json();
    this.sessionId = data.session_id;
    return data;
  }

  async deanonymize(text: string): Promise<DeanonymizeResponse> {
    const response = await fetch(`${this.baseUrl}/deanonymize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        session_id: this.sessionId
      })
    });
    
    return response.json();
  }

  async verifySignature(
    content: string,
    signature: string,
    publicKey: string,
    signingMethod = 'ecdsa'
  ): Promise<VerificationResponse> {
    const params = new URLSearchParams({
      content,
      signature,
      public_key: publicKey,
      signing_method: signingMethod
    });
    
    const response = await fetch(
      `${this.baseUrl}/verify-signature?${params}`
    );
    
    return response.json();
  }
}
```

### cURL Examples

```bash
# Anonymize text
curl -X POST http://localhost:8080/anonymize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Contact John at john@example.com or 555-1234"
  }'

# Save session ID from response, then deanonymize
curl -X POST http://localhost:8080/deanonymize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Contact <PERSON_0> at <EMAIL_ADDRESS_0> or <PHONE_NUMBER_0>",
    "session_id": "your-session-id-here"
  }'

# Verify signature
curl -G http://localhost:8080/verify-signature \
  --data-urlencode "content=Your text here" \
  --data-urlencode "signature=0xabc123..." \
  --data-urlencode "public_key=0x123abc..." \
  --data-urlencode "signing_method=ecdsa"
```

## WebSocket Support (Future)

For real-time bidirectional communication:

```javascript
// Future WebSocket implementation
const ws = new WebSocket('ws://localhost:8080/ws');

ws.on('message', (data) => {
  const { type, payload } = JSON.parse(data);
  if (type === 'anonymized') {
    console.log('Anonymized:', payload.text);
  }
});

ws.send(JSON.stringify({
  type: 'anonymize',
  text: 'John Doe lives here'
}));
```

## Next Steps

- 🏗️ [Architecture Overview](./ARCHITECTURE.md) - System design
- 🧪 [Testing Guide](./TESTING.md) - API testing strategies
- 🚀 [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- 🔒 [Security Guide](./SECURITY.md) - Security considerations