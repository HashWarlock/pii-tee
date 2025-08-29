import { useState, useCallback, useRef } from 'react'
import { getApiClient } from '@/lib/api-client'
import {
  DeanonymizeRequest,
  DeanonymizeResponse,
  ApiResponse,
  ApiError
} from '@/types/api'

export interface UseDeanonymizeOptions {
  onSuccess?: (response: DeanonymizeResponse) => void
  onError?: (error: ApiError) => void
}

export interface UseDeanonymizeReturn {
  // State
  data: DeanonymizeResponse | null
  isLoading: boolean
  error: ApiError | null
  progress: number

  // Actions
  deanonymize: (text: string, sessionId: string) => Promise<DeanonymizeResponse | null>
  reset: () => void
  cancel: () => void

  // Utilities
  canRetry: boolean
  retry: () => Promise<DeanonymizeResponse | null>
}

export function useDeanonymize(options: UseDeanonymizeOptions = {}): UseDeanonymizeReturn {
  const [data, setData] = useState<DeanonymizeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [progress, setProgress] = useState(0)
  const [lastRequest, setLastRequest] = useState<DeanonymizeRequest | null>(null)
  
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
        return prev + Math.random() * 15
      })
    }, 150)
    
    return () => clearInterval(interval)
  }, [])

  const deanonymize = useCallback(async (
    text: string,
    sessionId: string
  ): Promise<DeanonymizeResponse | null> => {
    if (!sessionId) {
      const sessionError: ApiError = {
        status: 400,
        message: 'Session ID is required for deanonymization',
        timestamp: new Date()
      }
      setError(sessionError)
      options.onError?.(sessionError)
      return null
    }

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

      const request: DeanonymizeRequest = {
        text,
        session_id: sessionId
      }

      setLastRequest(request)

      const response: ApiResponse<DeanonymizeResponse> = await apiClientRef.current.deanonymize(request)

      // Complete progress
      setProgress(100)
      cleanupProgress()

      if (response.success && response.data) {
        setData(response.data)
        options.onSuccess?.(response.data)
        return response.data
      } else if (response.error) {
        setError(response.error)
        options.onError?.(response.error)
        return null
      } else {
        const unknownError: ApiError = {
          status: 500,
          message: 'Unknown error occurred during deanonymization',
          timestamp: new Date()
        }
        setError(unknownError)
        options.onError?.(unknownError)
        return null
      }

    } catch (err) {
      const apiError: ApiError = {
        status: 0,
        message: err instanceof Error ? err.message : 'Request failed',
        timestamp: new Date()
      }
      setError(apiError)
      options.onError?.(apiError)
      return null
    } finally {
      setIsLoading(false)
      setProgress(0)
      abortControllerRef.current = null
    }
  }, [options, simulateProgress])

  const retry = useCallback(async (): Promise<DeanonymizeResponse | null> => {
    if (!lastRequest) {
      const retryError: ApiError = {
        status: 400,
        message: 'No previous request to retry',
        timestamp: new Date()
      }
      setError(retryError)
      return null
    }

    return deanonymize(lastRequest.text, lastRequest.session_id)
  }, [lastRequest, deanonymize])

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
    deanonymize,
    reset,
    cancel,

    // Utilities
    canRetry,
    retry
  }
}

export default useDeanonymize