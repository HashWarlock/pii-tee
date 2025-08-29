import {
  AnonymizeRequest,
  AnonymizeResponse,
  DeanonymizeRequest,
  DeanonymizeResponse,
  PublicKeyRequest,
  PublicKeyResponse,
  VerifySignatureRequest,
  VerifySignatureResponse,
  ApiConfig,
  ApiError,
  ApiResponse
} from '@/types/api'
import { getApiUrl } from '@/lib/runtime-config'

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export class PIITeeApiClient {
  private config: Required<ApiConfig>
  private abortController: AbortController | null = null

  constructor(config: ApiConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
      retryDelay: config.retryDelay ?? 1000
    }
  }

  /**
   * Generic HTTP request method with retry logic and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    // Create abort controller for timeout
    this.abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      this.abortController?.abort()
    }, this.config.timeout)

    try {
      const url = `${this.config.baseUrl}${endpoint}`
      console.log('[ApiClient.request] Making request:', {
        url,
        method: options.method || 'GET',
        body: options.body ? JSON.parse(options.body as string) : undefined
      })
      
      const response = await fetch(url, {
        ...options,
        signal: this.abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.detail || errorData.message || errorMessage
        } catch {
          // Use the raw text if JSON parsing fails
          if (errorText) {
            errorMessage = errorText
          }
        }

        throw new ApiClientError(response.status, errorMessage, errorText)
      }

      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return await response.json()
      } else {
        return await response.text() as T
      }

    } catch (error) {
      clearTimeout(timeoutId)
      
      // Handle abort errors (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        if (retryCount < this.config.retries) {
          console.warn(`Request timeout, retrying... (${retryCount + 1}/${this.config.retries})`)
          await this.delay(this.config.retryDelay * (retryCount + 1))
          return this.request<T>(endpoint, options, retryCount + 1)
        }
        throw new ApiClientError(408, 'Request timeout', 'The request took too long to complete')
      }

      // Handle network errors with retry
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (retryCount < this.config.retries) {
          console.warn(`Network error, retrying... (${retryCount + 1}/${this.config.retries})`)
          await this.delay(this.config.retryDelay * (retryCount + 1))
          return this.request<T>(endpoint, options, retryCount + 1)
        }
        throw new ApiClientError(0, 'Network error', 'Could not connect to the server')
      }

      // Handle API errors with retry for 5xx errors
      if (error instanceof ApiClientError) {
        if (error.status >= 500 && retryCount < this.config.retries) {
          console.warn(`Server error ${error.status}, retrying... (${retryCount + 1}/${this.config.retries})`)
          await this.delay(this.config.retryDelay * (retryCount + 1))
          return this.request<T>(endpoint, options, retryCount + 1)
        }
        throw error
      }

      // Re-throw unknown errors
      throw error
    }
  }

  /**
   * Utility method for adding delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Cancel ongoing requests
   */
  public cancelRequests(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  /**
   * Anonymize text using the PII-TEE service
   */
  public async anonymize(request: AnonymizeRequest): Promise<ApiResponse<AnonymizeResponse>> {
    console.log('[ApiClient] Anonymize called with:', {
      baseUrl: this.config.baseUrl,
      request,
      fullUrl: `${this.config.baseUrl}/anonymize`
    })
    
    try {
      const response = await this.request<AnonymizeResponse>('/anonymize', {
        method: 'POST',
        body: JSON.stringify(request)
      })
      console.log('[ApiClient] Anonymize response:', response)

      return {
        data: response,
        success: true
      }
    } catch (error) {
      const apiError: ApiError = {
        status: error instanceof ApiClientError ? error.status : 500,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof ApiClientError ? error.details : undefined,
        timestamp: new Date()
      }

      return {
        error: apiError,
        success: false
      }
    }
  }

  /**
   * Deanonymize text using the PII-TEE service
   */
  public async deanonymize(request: DeanonymizeRequest): Promise<ApiResponse<DeanonymizeResponse>> {
    try {
      const response = await this.request<DeanonymizeResponse>('/deanonymize', {
        method: 'POST',
        body: JSON.stringify(request)
      })

      return {
        data: response,
        success: true
      }
    } catch (error) {
      const apiError: ApiError = {
        status: error instanceof ApiClientError ? error.status : 500,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof ApiClientError ? error.details : undefined,
        timestamp: new Date()
      }

      return {
        error: apiError,
        success: false
      }
    }
  }

  /**
   * Get public key for signature verification
   */
  public async getPublicKey(request: PublicKeyRequest = {}): Promise<ApiResponse<PublicKeyResponse>> {
    try {
      const queryParams = new URLSearchParams()
      if (request.signing_method) {
        queryParams.append('signing_method', request.signing_method)
      }

      const endpoint = queryParams.toString() 
        ? `/public-key?${queryParams.toString()}`
        : '/public-key'

      const response = await this.request<PublicKeyResponse>(endpoint, {
        method: 'GET'
      })

      return {
        data: response,
        success: true
      }
    } catch (error) {
      const apiError: ApiError = {
        status: error instanceof ApiClientError ? error.status : 500,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof ApiClientError ? error.details : undefined,
        timestamp: new Date()
      }

      return {
        error: apiError,
        success: false
      }
    }
  }

  /**
   * Verify signature for given content
   */
  public async verifySignature(request: VerifySignatureRequest): Promise<ApiResponse<VerifySignatureResponse>> {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams()
      
      // Add each parameter individually to ensure proper encoding
      queryParams.append('content', request.content)
      queryParams.append('signature', request.signature)
      queryParams.append('public_key', request.public_key)
      queryParams.append('signing_method', request.signing_method)
      
      console.log('[ApiClient] Verify signature request:', {
        content: request.content.substring(0, 50) + '...',
        signature: request.signature.substring(0, 20) + '...',
        public_key: request.public_key.substring(0, 20) + '...',
        signing_method: request.signing_method
      })

      const response = await this.request<VerifySignatureResponse>(
        `/verify-signature?${queryParams.toString()}`,
        { method: 'GET' }
      )

      return {
        data: response,
        success: true
      }
    } catch (error) {
      const apiError: ApiError = {
        status: error instanceof ApiClientError ? error.status : 500,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof ApiClientError ? error.details : undefined,
        timestamp: new Date()
      }

      console.error('[ApiClient] Verify signature failed:', apiError)

      return {
        error: apiError,
        success: false
      }
    }
  }

  /**
   * Health check endpoint (if available)
   */
  public async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    try {
      const response = await this.request<{ status: string }>('/health', {
        method: 'HEAD'
      })

      return {
        data: response || { status: 'ok' },
        success: true
      }
    } catch (error) {
      const apiError: ApiError = {
        status: error instanceof ApiClientError ? error.status : 500,
        message: error instanceof Error ? error.message : 'Health check failed',
        details: error instanceof ApiClientError ? error.details : undefined,
        timestamp: new Date()
      }

      return {
        error: apiError,
        success: false
      }
    }
  }

  /**
   * Update API configuration
   */
  public updateConfig(newConfig: Partial<ApiConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      baseUrl: newConfig.baseUrl?.replace(/\/$/, '') ?? this.config.baseUrl
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): ApiConfig {
    return { ...this.config }
  }
}

// Default client instance
let defaultClient: PIITeeApiClient | null = null

/**
 * Get the default API client instance
 */
export function getApiClient(config?: ApiConfig): PIITeeApiClient {
  if (!defaultClient || config) {
    const clientConfig = config ?? {
      baseUrl: getApiUrl(), // Use runtime configuration instead of build-time env var
      timeout: 30000,
      retries: 3,
      retryDelay: 1000
    }
    defaultClient = new PIITeeApiClient(clientConfig)
  }
  return defaultClient
}

/**
 * Set a custom default API client
 */
export function setApiClient(client: PIITeeApiClient): void {
  defaultClient = client
}

// Legacy export for backward compatibility
export const apiClient = getApiClient()

export default PIITeeApiClient