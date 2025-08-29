import { NextRequest, NextResponse } from 'next/server'

// This API route proxies all requests to the backend API service
// Browser -> Next.js API Route -> Docker pii-api service

const API_URL = process.env.API_URL || 'http://pii-api:80'

type RouteParams = {
  params: Promise<{ proxy: string[] }>
}

export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  const params = await context.params
  return handleProxy(request, params.proxy, 'GET')
}

export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  const params = await context.params
  return handleProxy(request, params.proxy, 'POST')
}

export async function PUT(
  request: NextRequest,
  context: RouteParams
) {
  const params = await context.params
  return handleProxy(request, params.proxy, 'PUT')
}

export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  const params = await context.params
  return handleProxy(request, params.proxy, 'DELETE')
}

export async function PATCH(
  request: NextRequest,
  context: RouteParams
) {
  const params = await context.params
  return handleProxy(request, params.proxy, 'PATCH')
}

export async function OPTIONS(
  request: NextRequest,
  context: RouteParams
) {
  // Handle CORS preflight requests
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

export async function HEAD(
  request: NextRequest,
  context: RouteParams
) {
  const params = await context.params
  return handleProxy(request, params.proxy, 'HEAD')
}

async function handleProxy(
  request: NextRequest,
  proxyPath: string[],
  method: string
) {
  try {
    // Reconstruct the path (everything after /api/)
    const path = proxyPath ? proxyPath.join('/') : ''
    
    // Build the target URL - using Docker service name
    const targetUrl = `${API_URL}/${path}`
    
    // Get query string from the request
    // Note: nextUrl.search already includes the '?' and is properly encoded
    const queryString = request.nextUrl.search
    const fullUrl = queryString ? `${targetUrl}${queryString}` : targetUrl
    
    console.log(`[API Proxy] ${method} ${path}${queryString} -> ${fullUrl}`)
    
    // Log query parameters for debugging
    if (queryString && path === 'verify-signature') {
      const params = new URLSearchParams(queryString)
      console.log('[API Proxy] verify-signature params:', {
        content: params.get('content')?.substring(0, 50) + '...',
        signature: params.get('signature')?.substring(0, 20) + '...',
        public_key: params.get('public_key')?.substring(0, 20) + '...',
        signing_method: params.get('signing_method')
      })
    }
    
    // Forward headers from the original request (excluding host)
    const requestHeaders: HeadersInit = {}
    request.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'host') {
        requestHeaders[key] = value
      }
    })
    
    // Ensure content-type is set for JSON endpoints
    if (!requestHeaders['content-type'] && (path.includes('anonymize') || path.includes('deanonymize'))) {
      requestHeaders['content-type'] = 'application/json'
    }
    
    // Prepare the fetch options
    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
    }
    
    // Add body for non-GET requests
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        const contentType = request.headers.get('content-type')
        
        if (contentType?.includes('application/json')) {
          // For JSON, read and forward as-is
          const body = await request.text()
          if (body) {
            fetchOptions.body = body
            console.log(`[API Proxy] Forwarding JSON body:`, body.substring(0, 100))
          }
        } else if (contentType?.includes('multipart/form-data')) {
          // For form data, forward as-is
          fetchOptions.body = await request.formData()
        } else {
          // Default: forward as text
          const body = await request.text()
          if (body) {
            fetchOptions.body = body
          }
        }
      } catch (e) {
        console.error('[API Proxy] Error reading request body:', e)
      }
    }
    
    // Forward the request to the backend API
    const response = await fetch(fullUrl, fetchOptions)
    
    console.log(`[API Proxy] Response status: ${response.status}`)
    
    // Log error responses for debugging
    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[API Proxy] Error response (${response.status}):`, errorBody)
      
      // Try to parse as JSON for better error reporting
      try {
        const errorJson = JSON.parse(errorBody)
        return NextResponse.json(errorJson, {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        })
      } catch {
        // Return as plain text if not JSON
        return new NextResponse(errorBody, {
          status: response.status,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
          }
        })
      }
    }
    
    // Handle different response types
    const contentType = response.headers.get('content-type')
    
    if (contentType?.includes('application/json')) {
      // JSON response
      const responseData = await response.json()
      return NextResponse.json(responseData, { 
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        }
      })
    } else if (contentType?.includes('text/html')) {
      // HTML response (like FastAPI docs)
      const html = await response.text()
      return new NextResponse(html, {
        status: response.status,
        headers: {
          'Content-Type': 'text/html',
        }
      })
    } else {
      // Default: return as text
      const responseText = await response.text()
      
      // Try to parse as JSON if possible
      try {
        const jsonData = JSON.parse(responseText)
        return NextResponse.json(jsonData, { 
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        })
      } catch {
        // Not JSON, return as text
        return new NextResponse(responseText, {
          status: response.status,
          headers: {
            'Content-Type': 'text/plain',
          }
        })
      }
    }
    
  } catch (error) {
    console.error('[API Proxy] Error:', error)
    return NextResponse.json(
      { 
        error: 'API proxy error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }
}