#!/bin/bash

# Test signature verification functionality
# This script tests the full signature verification flow

set -e

API_URL="${API_URL:-http://localhost:8080}"
SESSION_ID="test-verify-$(date +%s)"

echo "🧪 Testing Signature Verification"
echo "================================="
echo "API URL: $API_URL"
echo "Session ID: $SESSION_ID"
echo ""

# 1. Test anonymization with signature generation
echo "1️⃣ Testing anonymization with signature generation..."
RESPONSE=$(curl -s -X POST "$API_URL/anonymize" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"John Doe lives at john@example.com\",
    \"session_id\": \"$SESSION_ID\"
  }")

echo "$RESPONSE" | jq '.'

# Extract fields
TEXT=$(echo "$RESPONSE" | jq -r '.text')
SIGNATURE=$(echo "$RESPONSE" | jq -r '.signature')
PUBLIC_KEY=$(echo "$RESPONSE" | jq -r '.public_key')
SIGNING_METHOD=$(echo "$RESPONSE" | jq -r '.signing_method')

echo ""
echo "📝 Extracted data:"
echo "  Text: $TEXT"
echo "  Signature: ${SIGNATURE:0:40}..."
echo "  Public Key: ${PUBLIC_KEY:0:40}..."
echo "  Signing Method: $SIGNING_METHOD"
echo ""

# 2. Test signature verification
echo "2️⃣ Testing signature verification..."

# URL encode the parameters
ENCODED_TEXT=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TEXT'))")
ENCODED_SIGNATURE=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$SIGNATURE'))")
ENCODED_PUBLIC_KEY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$PUBLIC_KEY'))")
ENCODED_METHOD=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$SIGNING_METHOD'))")

VERIFY_URL="$API_URL/verify-signature?content=$ENCODED_TEXT&signature=$ENCODED_SIGNATURE&public_key=$ENCODED_PUBLIC_KEY&signing_method=$ENCODED_METHOD"

VERIFY_RESPONSE=$(curl -s -X GET "$VERIFY_URL")

echo "$VERIFY_RESPONSE" | jq '.'

# Check if verification was successful
IS_VALID=$(echo "$VERIFY_RESPONSE" | jq -r '.data.is_valid')

if [ "$IS_VALID" = "true" ]; then
  echo "✅ Signature verification PASSED!"
else
  echo "❌ Signature verification FAILED!"
  echo "   Expected: true"
  echo "   Got: $IS_VALID"
  exit 1
fi

echo ""
echo "3️⃣ Testing with modified content (should fail)..."

# Modify the content slightly
MODIFIED_TEXT="Modified content"
ENCODED_MODIFIED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$MODIFIED_TEXT'))")

INVALID_URL="$API_URL/verify-signature?content=$ENCODED_MODIFIED&signature=$ENCODED_SIGNATURE&public_key=$ENCODED_PUBLIC_KEY&signing_method=$ENCODED_METHOD"

INVALID_RESPONSE=$(curl -s -X GET "$INVALID_URL")

echo "$INVALID_RESPONSE" | jq '.'

IS_INVALID=$(echo "$INVALID_RESPONSE" | jq -r '.data.is_valid')

if [ "$IS_INVALID" = "false" ]; then
  echo "✅ Invalid signature correctly rejected!"
else
  echo "❌ Invalid signature was incorrectly accepted!"
  exit 1
fi

echo ""
echo "4️⃣ Testing different signing methods..."

# Get public key info
PUBLIC_KEY_RESPONSE=$(curl -s -X GET "$API_URL/public-key")
echo "$PUBLIC_KEY_RESPONSE" | jq '.'

echo ""
echo "======================================"
echo "✅ All signature verification tests passed!"
echo "======================================"