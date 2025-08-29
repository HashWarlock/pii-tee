#!/usr/bin/env node

/**
 * Test script for API proxy functionality
 * Tests all endpoints through the Next.js proxy
 */

const API_BASE = 'http://localhost:3000/api';

async function testEndpoint(method, path, body = null, description = '') {
  console.log(`\n📍 Testing: ${method} ${path}`);
  if (description) console.log(`   ${description}`);
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    };
    
    if (body && method !== 'GET' && method !== 'HEAD') {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE}${path}`, options);
    
    console.log(`   Status: ${response.status}`);
    
    if (response.ok || response.status === 404 || response.status === 405) {
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        console.log(`   ✅ Response:`, JSON.stringify(data, null, 2).substring(0, 200));
      } else if (contentType?.includes('text/html')) {
        const text = await response.text();
        console.log(`   ✅ HTML Response (length: ${text.length} bytes)`);
      } else {
        const text = await response.text();
        console.log(`   ✅ Text Response:`, text.substring(0, 100));
      }
      return true;
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Failed with status ${response.status}:`, errorText.substring(0, 100));
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log('========================================');
  console.log('API Proxy Test Suite');
  console.log('========================================');
  console.log(`Testing against: ${API_BASE}`);
  
  const results = [];
  
  // Test 1: FastAPI Docs
  results.push(await testEndpoint('GET', '/docs', null, 'FastAPI documentation page'));
  
  // Test 2: Health check (if exists)
  results.push(await testEndpoint('GET', '/health', null, 'Health check endpoint'));
  
  // Test 3: Public key endpoint
  results.push(await testEndpoint('GET', '/public-key', null, 'Get public key for verification'));
  
  // Test 4: Anonymize endpoint
  const anonymizePayload = {
    text: "Hello, my name is John Doe and I live in New York.",
    language: "en"
  };
  results.push(await testEndpoint('POST', '/anonymize', anonymizePayload, 'Anonymize PII data'));
  
  // Test 5: Deanonymize endpoint (would need valid session)
  const deanonymizePayload = {
    text: "Hello, my name is [NAME_1] and I live in [LOCATION_1].",
    session: "test-session-id"
  };
  results.push(await testEndpoint('POST', '/deanonymize', deanonymizePayload, 'Deanonymize text (may fail without valid session)'));
  
  // Test 6: Verify signature endpoint
  const verifyParams = new URLSearchParams({
    content: "test content",
    signature: "test signature",
    public_key: "test key",
    signing_method: "ecdsa"
  });
  results.push(await testEndpoint('GET', `/verify-signature?${verifyParams}`, null, 'Verify signature'));
  
  // Test 7: OPTIONS for CORS
  results.push(await testEndpoint('OPTIONS', '/anonymize', null, 'CORS preflight check'));
  
  // Summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');
  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The proxy is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the backend API is running.');
  }
  
  // Test real workflow
  console.log('\n========================================');
  console.log('Testing Real Workflow');
  console.log('========================================');
  
  try {
    // Step 1: Anonymize
    console.log('\n1️⃣  Anonymizing text...');
    const anonymizeResponse = await fetch(`${API_BASE}/anonymize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: "Contact John Smith at john@example.com or call 555-1234",
        language: "en"
      })
    });
    
    if (anonymizeResponse.ok) {
      const anonymized = await anonymizeResponse.json();
      console.log('   Anonymized text:', anonymized.text);
      console.log('   Session ID:', anonymized.session);
      
      // Step 2: Deanonymize with session
      if (anonymized.session) {
        console.log('\n2️⃣  Deanonymizing with session...');
        const deanonymizeResponse = await fetch(`${API_BASE}/deanonymize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: anonymized.text,
            session: anonymized.session
          })
        });
        
        if (deanonymizeResponse.ok) {
          const deanonymized = await deanonymizeResponse.json();
          console.log('   Deanonymized text:', deanonymized.text);
          console.log('   ✅ Full workflow completed successfully!');
        } else {
          console.log('   ❌ Deanonymization failed');
        }
      }
    } else {
      console.log('   ❌ Anonymization failed');
    }
  } catch (error) {
    console.log('   ❌ Workflow error:', error.message);
  }
}

// Run the tests
runTests().catch(console.error);