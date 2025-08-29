import { useState, useCallback, useRef } from 'react'
import { getApiClient } from '@/lib/api-client'
import {
  AnonymizeRequest,
  AnonymizeResponse,
  ApiResponse,
  ApiError
} from '@/types/api'

export interface UseAnonymizeOptions {
  onSuccess?: (response: AnonymizeResponse) => void
  onError?: (error: ApiError) => void
  defaultLanguage?: string
}

export interface UseAnonymizeReturn {
  // State
  data: AnonymizeResponse | null
  isLoading: boolean
  error: ApiError | null
  progress: number // 0-100 for progress indication

  // Actions
  anonymize: (text: string, language?: string, sessionId?: string) => Promise<ApiResponse<AnonymizeResponse>>
  reset: () => void
  cancel: () => void

  // Utilities
  canRetry: boolean
  retry: () => Promise<ApiResponse<AnonymizeResponse> | null>
}

export function useAnonymize(options: UseAnonymizeOptions = {}): UseAnonymizeReturn {
  const [data, setData] = useState<AnonymizeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [progress, setProgress] = useState(0)
  const [lastRequest, setLastRequest] = useState<AnonymizeRequest | null>(null)
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const apiClientRef = useRef(getApiClient())

  // Simulate progress for better UX
  const simulateProgress = useCallback(() => {
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval)
          return prev
        }
        return prev + Math.random() * 20
      })
    }, 200)
    
    return () => clearInterval(interval)
  }, [])

  const anonymize = useCallback(async (
    text: string,
    language: string = 'en',
    sessionId?: string
  ): Promise<ApiResponse<AnonymizeResponse>> => {
    console.log('[useAnonymize] Starting anonymize request:', {
      textLength: text.length,
      language,
      sessionId,
      apiUrl: process.env.NEXT_PUBLIC_API_URL
    })
    
    try {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      abortControllerRef.current = new AbortController()

      setIsLoading(true)
      setError(null)
      setData(null)

      const cleanupProgress = simulateProgress()

      const request: AnonymizeRequest = {
        text,
        language: language ?? options.defaultLanguage ?? 'en',
        session_id: sessionId ?? undefined
      }

      setLastRequest(request)

      console.log('[useAnonymize] Sending request to API:', request)
      const response: ApiResponse<AnonymizeResponse> = await apiClientRef.current.anonymize(request)
      console.log('[useAnonymize] API response received:', response)

      // Complete progress
      setProgress(100)
      cleanupProgress()

      if (response.success && response.data) {
        setData(response.data)
        options.onSuccess?.(response.data)
      } else if (response.error) {
        console.error('[useAnonymize] API error:', response.error)
        setError(response.error)
        options.onError?.(response.error)
      }
      
      return response

    } catch (err) {
      console.error('[useAnonymize] Request failed with exception:', err)
      const apiError: ApiError = {
        status: 0,
        message: err instanceof Error ? err.message : 'Request failed',
        timestamp: new Date()
      }
      setError(apiError)
      options.onError?.(apiError)
      return { success: false, error: apiError }
    } finally {
      setIsLoading(false)
      setProgress(0)
      abortControllerRef.current = null
    }
  }, [options, simulateProgress])

  const retry = useCallback(async (): Promise<ApiResponse<AnonymizeResponse> | null> => {
    if (!lastRequest) {
      const retryError: ApiError = {
        status: 400,
        message: 'No previous request to retry',
        timestamp: new Date()
      }
      setError(retryError)
      return null
    }

    return anonymize(lastRequest.text, lastRequest.language, lastRequest.session_id)
  }, [lastRequest, anonymize])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setProgress(0)
    setLastRequest(null)
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    
    setIsLoading(false)
    setProgress(0)
  }, [])

  const canRetry = Boolean(lastRequest && error && !isLoading)

  return {
    // State
    data,
    isLoading,
    error,
    progress,

    // Actions
    anonymize,
    reset,
    cancel,

    // Utilities
    canRetry,
    retry
  }
}

export default useAnonymize