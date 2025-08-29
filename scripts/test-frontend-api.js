#!/usr/bin/env node

// Test script to debug frontend API errors
const http = require('http');

console.log('🧪 Testing API endpoints and frontend integration\n');

// Configuration
const API_PORT = process.env.API_PORT || 8080;
const CLIENT_PORT = process.env.CLIENT_PORT || 3000;

// Test data
const testRequest = {
  text: "My name is John Doe and my email is john@example.com",
  language: "en"
};

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testEndpoint(name, options, data = null) {
  console.log(`Testing ${name}...`);
  try {
    const response = await makeRequest(options, data);
    console.log(`  ✅ Status: ${response.statusCode}`);
    
    if (response.body) {
      try {
        const parsed = JSON.parse(response.body);
        console.log(`  📦 Response:`, JSON.stringify(parsed, null, 2).substring(0, 200));
      } catch {
        console.log(`  📦 Response (text):`, response.body.substring(0, 200));
      }
    }
    
    return response;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function runTests() {
  console.log('1️⃣ Testing Direct API Endpoints\n');
  
  // Test anonymize endpoint
  const anonymizeResponse = await testEndpoint('POST /anonymize', {
    hostname: 'localhost',
    port: API_PORT,
    path: '/anonymize',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, testRequest);
  
  console.log();
  
  // Extract session_id if available
  let sessionId = null;
  if (anonymizeResponse && anonymizeResponse.statusCode === 200) {
    try {
      const data = JSON.parse(anonymizeResponse.body);
      sessionId = data.session_id;
      console.log(`  💾 Session ID: ${sessionId}\n`);
    } catch {}
  }
  
  // Test deanonymize if we have a session
  if (sessionId) {
    const deanonymizeResponse = await testEndpoint('POST /deanonymize', {
      hostname: 'localhost',
      port: API_PORT,
      path: '/deanonymize',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      text: "My name is <NAME_1> and my email is <EMAIL_1>",
      session_id: sessionId
    });
    
    console.log();
  }
  
  // Test public-key endpoint
  await testEndpoint('GET /public-key', {
    hostname: 'localhost',
    port: API_PORT,
    path: '/public-key',
    method: 'GET'
  });
  
  console.log();
  
  // Test health endpoint (if exists)
  await testEndpoint('GET /health', {
    hostname: 'localhost',
    port: API_PORT,
    path: '/health',
    method: 'GET'
  });
  
  console.log('\n2️⃣ Testing Frontend Proxy (if running)\n');
  
  // Test frontend's API proxy
  await testEndpoint('Frontend API Health', {
    hostname: 'localhost',
    port: CLIENT_PORT,
    path: '/api/health',
    method: 'GET'
  });
  
  console.log('\n3️⃣ CORS Headers Check\n');
  
  // Check CORS headers
  const corsResponse = await testEndpoint('CORS Preflight', {
    hostname: 'localhost',
    port: API_PORT,
    path: '/anonymize',
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type'
    }
  });
  
  if (corsResponse && corsResponse.headers) {
    console.log('  CORS Headers:');
    console.log(`    Access-Control-Allow-Origin: ${corsResponse.headers['access-control-allow-origin']}`);
    console.log(`    Access-Control-Allow-Methods: ${corsResponse.headers['access-control-allow-methods']}`);
    console.log(`    Access-Control-Allow-Headers: ${corsResponse.headers['access-control-allow-headers']}`);
  }
  
  console.log('\n✅ Tests completed!');
  
  // Summary
  console.log('\n📊 Summary:');
  console.log('  - API should be running on port', API_PORT);
  console.log('  - Frontend should be running on port', CLIENT_PORT);
  console.log('  - Check if TEE simulator is running: ./scripts/setup_tee_simulator.sh status');
}

// Run tests
runTests().catch(console.error);