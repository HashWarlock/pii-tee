/**
 * Runtime configuration for API URL
 * 
 * IMPORTANT: Browser JavaScript cannot access environment variables!
 * We use Next.js API routes as a proxy to forward requests to the backend.
 * 
 * Flow:
 * 1. Browser calls /api/* (Next.js API route)
 * 2. Next.js API route forwards to http://pii-api:80 (Docker service)
 * 3. Response is returned to browser
 */

export function getApiUrl(): string {
  // Server-side rendering - can use Docker service directly
  if (typeof window === 'undefined') {
    const ssrUrl = process.env.API_URL || 'http://pii-api:80';
    console.log('[runtime-config] SSR URL (server-side can use Docker names):', ssrUrl);
    return ssrUrl;
  }

  // Client-side (browser) - ALWAYS use our API proxy route
  // The browser calls our Next.js API, which forwards to the Docker service
  console.log('[runtime-config] Browser mode - using Next.js API proxy: /api');
  return '/api';
}

/**
 * Get the full API endpoint URL
 * @param endpoint - The API endpoint path (e.g., '/anonymize')
 */
export function getApiEndpoint(endpoint: string): string {
  const baseUrl = getApiUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // For API proxy routes, the format is /api/endpoint
  if (baseUrl === '/api') {
    return `/api${cleanEndpoint}`;
  }
  
  // For direct server-side calls
  return `${baseUrl}${cleanEndpoint}`;
}

/**
 * Check if we're in a production environment
 */
export function isProduction(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'production';
  }
  
  const hostname = window.location.hostname;
  return hostname !== 'localhost' && hostname !== '127.0.0.1';
}

// Export a singleton config object for convenience
export const runtimeConfig = {
  getApiUrl,
  getApiEndpoint,
  isProduction,
};

export default runtimeConfig;