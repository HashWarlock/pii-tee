# Frequently Asked Questions (FAQ)

## General Questions

### What is PII-TEE?

PII-TEE is a privacy-preserving text anonymization service that uses Trusted Execution Environment (TEE) technology to protect sensitive data. It allows you to:
- Anonymize personally identifiable information (PII) in text
- Maintain conversation coherence with consistent replacements
- Cryptographically sign and verify all operations
- Reverse anonymization when needed using session-based mappings

### What types of PII does it detect?

PII-TEE detects and anonymizes:
- **Personal Names**: John Doe → `<PERSON_0>`
- **Email Addresses**: john@example.com → `<EMAIL_ADDRESS_0>`
- **Phone Numbers**: 555-1234 → `<PHONE_NUMBER_0>`
- **Locations**: New York → `<LOCATION_0>`
- **Credit Cards**: 4111-1111-1111-1111 → `<CREDIT_CARD_0>`
- **IP Addresses**: 192.168.1.1 → `<IP_ADDRESS_0>`
- **URLs**: https://example.com → `<URL_0>`
- **Dates**: January 1, 2024 → `<DATE_TIME_0>`
- **Medical Records**: MRN123456 → `<MEDICAL_LICENSE_0>`
- **Crypto Addresses**: 0xabc...123 → `<CRYPTO_0>`

### How does the anonymization maintain consistency?

The system uses an "instance counter" pattern:
- Same entities within a session always get the same replacement
- "John called John's friend" → "<PERSON_0> called <PERSON_0>'s friend"
- Different entities get different numbers: "John met Jane" → "<PERSON_0> met <PERSON_1>"

### What is TEE and why is it important?

TEE (Trusted Execution Environment) provides:
- **Hardware-based security**: Code runs in an isolated enclave
- **Attestation**: Cryptographic proof that code hasn't been tampered with
- **Confidentiality**: Data is encrypted in memory
- **Integrity**: Prevents unauthorized modifications

Supported TEE technologies:
- Intel SGX (Software Guard Extensions)
- Intel TDX (Trust Domain Extensions)
- AMD SEV (Secure Encrypted Virtualization)
- ARM TrustZone

## Technical Questions

### What's the difference between ECDSA and Ed25519?

| Feature | ECDSA | Ed25519 |
|---------|-------|---------|
| **Default** | Yes (as of latest update) | No |
| **Public Key** | Ethereum address (0x...) | Base64 encoded |
| **Signature Size** | ~132 characters | 128 characters |
| **Verification Speed** | Good | Faster |
| **Use Case** | Web3/Ethereum compatibility | High-performance apps |

To change signing method:
```bash
# In .env
SIGNING_METHOD=ecdsa  # or ed25519
```

### How long are sessions stored?

Default session TTL is 1 hour. Configure in `.env`:
```bash
REDIS_TTL=3600  # seconds (1 hour)
REDIS_TTL=7200  # 2 hours
REDIS_TTL=86400 # 24 hours
```

Sessions are automatically cleaned up after expiration.

### Can I use this without Docker?

Yes, you can run natively:

**API:**
```bash
cd src/api
pip install -r requirements.txt
python -m spacy download en_core_web_lg
uvicorn main:app --port 8080
```

**Frontend:**
```bash
cd src/client_app
npm install
npm run dev
```

**Redis:**
```bash
# Install Redis locally
brew install redis  # macOS
apt-get install redis-server  # Ubuntu

# Start Redis
redis-server --requirepass yourpassword
```

### How do I add support for other languages?

1. Download the language model:
```bash
python -m spacy download de_core_news_sm  # German
python -m spacy download fr_core_news_sm  # French
python -m spacy download es_core_news_sm  # Spanish
```

2. Update the API call:
```json
{
  "text": "Der Text auf Deutsch",
  "language": "de"
}
```

3. Supported languages: English (en), Spanish (es), French (fr), German (de), Italian (it), Portuguese (pt), Dutch (nl), Polish (pl), Russian (ru), Chinese (zh), Japanese (ja)

### Can I integrate this with my LLM application?

Yes! PII-TEE is designed for LLM integration:

```python
# Example integration
import requests

class SecureLLMClient:
    def __init__(self, pii_tee_url="http://localhost:8080"):
        self.pii_tee = pii_tee_url
        self.session_id = None
    
    def process_user_input(self, user_text):
        # 1. Anonymize user input
        anon_response = requests.post(
            f"{self.pii_tee}/anonymize",
            json={"text": user_text, "session_id": self.session_id}
        ).json()
        
        self.session_id = anon_response["session_id"]
        anonymized_text = anon_response["text"]
        
        # 2. Send to LLM (e.g., OpenAI)
        llm_response = call_llm_api(anonymized_text)
        
        # 3. Deanonymize LLM response
        deanon_response = requests.post(
            f"{self.pii_tee}/deanonymize",
            json={"text": llm_response, "session_id": self.session_id}
        ).json()
        
        return deanon_response["text"]
```

## Deployment Questions

### What are the minimum system requirements?

**Development:**
- 2 CPU cores
- 4GB RAM
- 10GB disk space
- Docker Desktop or Docker Engine

**Production:**
- 4+ CPU cores
- 8GB+ RAM
- 20GB+ disk space
- TEE-enabled hardware (for attestation)
- SSL certificate

### How do I deploy to the cloud?

Quick deployment options:

**Phala Cloud:**
```bash
phala deploy -c docker-compose-prod.yaml
```


See [Deployment Guide](./DEPLOYMENT.md) for detailed instructions.

## Security Questions

### Is my data stored anywhere?

- **Original text**: Never stored, only processed in memory
- **Anonymized text**: Not persisted beyond the session
- **Entity mappings**: Stored in Redis with TTL, encrypted at rest
- **Logs**: No PII is logged, only metadata

### How secure is the anonymization?

Security measures:
- Cryptographic signatures on all operations
- TEE attestation for computation integrity
- Session isolation (no data leakage between sessions)
- Automatic session expiration
- No permanent storage of sensitive data

### Can the anonymization be reversed by attackers?

Without the session ID and entity mappings:
- Reversal is computationally infeasible
- Each session uses unique mappings
- Mappings are deleted after TTL expiration

With the session ID:
- Only authorized users with session ID can deanonymize
- Implement additional authentication in production

### What about GDPR compliance?

PII-TEE helps with GDPR compliance:
- **Data minimization**: Only process what's needed
- **Pseudonymization**: Replace PII with placeholders
- **Right to erasure**: Sessions auto-delete
- **Data portability**: Export anonymized data
- **Audit trail**: Cryptographic signatures provide proof

## Performance Questions

### How fast is the anonymization?

Typical performance:
- **Small text** (< 100 chars): ~50ms
- **Medium text** (< 1000 chars): ~100ms
- **Large text** (< 10000 chars): ~500ms

Factors affecting performance:
- Number of PII entities
- Text complexity
- Language model size
- Hardware specifications

### How many concurrent users can it handle?

With default configuration:
- **Development** (2 CPU, 4GB RAM): ~50 concurrent users
- **Production** (4 CPU, 8GB RAM): ~500 concurrent users
- **Scaled** (8 CPU, 16GB RAM): ~2000 concurrent users

Scale horizontally for more capacity.

### How can I improve performance?

1. **Use lighter language models:**
```python
# Use small model for better performance
python -m spacy download en_core_web_sm
```

2. **Enable caching:**
```python
from functools import lru_cache

@lru_cache(maxsize=1000)
def cached_anonymize(text):
    return anonymize(text)
```

3. **Increase resources:**
```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 8G
```

4. **Use Redis cluster for high availability**

## Troubleshooting Questions

### Why am I getting "Session not found" errors?

Common causes:
1. Session expired (default 1 hour)
2. Redis restarted and lost data
3. Using wrong session ID
4. Session from different environment

Solution:
- Start a new session
- Increase TTL if needed
- Implement session persistence

### Why are signatures showing as invalid?

Check:
1. Signing method matches (ECDSA vs Ed25519)
2. Content hasn't been modified
3. Using correct public key
4. No encoding issues

Debug:
```bash
./scripts/test/test-signature-verification.sh
```

### Why is the frontend showing a blank page?

Common fixes:
1. Clear browser cache (Ctrl+Shift+R)
2. Check browser console for errors
3. Verify API is running: `curl http://localhost:8080/health`
4. Rebuild frontend: `docker compose build client-app`

### How do I enable debug logging?

```bash
# In .env
LOG_LEVEL=DEBUG

# Restart services
docker compose restart

# View logs
docker compose logs -f
```

## Contributing Questions

### How can I contribute?

We welcome contributions! See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Code of conduct
- Development setup
- Pull request process
- Coding standards

### Where can I report bugs?

- **GitHub Issues**: [Create an issue](https://github.com/HashWarlock/pii-tee/issues)
- **Security Issues**: Email security@yourdomain.com (don't post publicly)

### How do I request features?

1. Check existing [feature requests](https://github.com/HashWarlock/pii-tee/issues?q=label%3Aenhancement)
2. Create a new issue with label "enhancement"
3. Describe use case and benefits
4. Consider submitting a PR!

## Additional Resources

- 📖 [Getting Started Guide](./GETTING_STARTED.md)
- 🏗️ [Architecture Overview](./ARCHITECTURE.md)
- 🧪 [Testing Guide](./TESTING.md)
- 🚀 [Deployment Guide](./DEPLOYMENT.md)
- 🔧 [API Reference](./API.md)
- 🐛 [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

Still have questions? Open a [discussion](https://github.com/HashWarlock/pii-tee/discussions) on GitHub!