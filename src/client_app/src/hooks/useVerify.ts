import { useState, useCallback, useRef } from 'react'
import { getApiClient } from '@/lib/api-client'
import {
  VerifySignatureRequest,
  VerifySignatureResponse,
  PublicKeyRequest,
  PublicKeyResponse,
  ApiResponse,
  ApiError
} from '@/types/api'

export interface UseVerifyOptions {
  onSuccess?: (response: VerifySignatureResponse) => void
  onError?: (error: ApiError) => void
  onPublicKeySuccess?: (response: PublicKeyResponse) => void
}

export interface UseVerifyReturn {
  // Verification state
  verificationData: VerifySignatureResponse | null
  isVerifying: boolean
  verificationError: ApiError | null

  // Public key state
  publicKeyData: PublicKeyResponse | null
  isLoadingPublicKey: boolean
  publicKeyError: ApiError | null

  // Progress
  progress: number

  // Actions
  verifySignature: (request: VerifySignatureRequest) => Promise<VerifySignatureResponse | null>
  getPublicKey: (signingMethod?: string) => Promise<PublicKeyResponse | null>
  reset: () => void
  cancel: () => void

  // Utilities
  canRetryVerification: boolean
  canRetryPublicKey: boolean
  retryVerification: () => Promise<VerifySignatureResponse | null>
  retryPublicKey: () => Promise<PublicKeyResponse | null>

  // Combined state
  isLoading: boolean
  hasError: boolean
}

export function useVerify(options: UseVerifyOptions = {}): UseVerifyReturn {
  // Verification state
  const [verificationData, setVerificationData] = useState<VerifySignatureResponse | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationError, setVerificationError] = useState<ApiError | null>(null)
  const [lastVerifyRequest, setLastVerifyRequest] = useState<VerifySignatureRequest | null>(null)

  // Public key state
  const [publicKeyData, setPublicKeyData] = useState<PublicKeyResponse | null>(null)
  const [isLoadingPublicKey, setIsLoadingPublicKey] = useState(false)
  const [publicKeyError, setPublicKeyError] = useState<ApiError | null>(null)
  const [lastPublicKeyRequest, setLastPublicKeyRequest] = useState<PublicKeyRequest | null>(null)

  // Progress
  const [progress, setProgress] = useState(0)

  const abortControllerRef = useRef<AbortController | null>(null)
  const apiClientRef = useRef(getApiClient())

  // Simulate progress for better UX
  const simulateProgress = useCallback((duration = 1000) => {
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval)
          return prev
        }
        return prev + Math.random() * 10
      })
    }, duration / 10)
    
    return () => clearInterval(interval)
  }, [])

  const verifySignature = useCallback(async (
    request: VerifySignatureRequest
  ): Promise<VerifySignatureResponse | null> => {
    try {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      abortControllerRef.current = new AbortController()

      setIsVerifying(true)
      setVerificationError(null)
      setVerificationData(null)

      const cleanupProgress = simulateProgress(800)
      setLastVerifyRequest(request)

      const response: ApiResponse<VerifySignatureResponse> = await apiClientRef.current.verifySignature(request)

      // Complete progress
      setProgress(100)
      cleanupProgress()

      if (response.success && response.data) {
        setVerificationData(response.data)
        options.onSuccess?.(response.data)
        return response.data
      } else if (response.error) {
        setVerificationError(response.error)
        options.onError?.(response.error)
        return null
      } else {
        const unknownError: ApiError = {
          status: 500,
          message: 'Unknown error occurred during signature verification',
          timestamp: new Date()
        }
        setVerificationError(unknownError)
        options.onError?.(unknownError)
        return null
      }

    } catch (err) {
      const apiError: ApiError = {
        status: 0,
        message: err instanceof Error ? err.message : 'Verification request failed',
        timestamp: new Date()
      }
      setVerificationError(apiError)
      options.onError?.(apiError)
      return null
    } finally {
      setIsVerifying(false)
      setProgress(0)
      abortControllerRef.current = null
    }
  }, [options, simulateProgress])

  const getPublicKey = useCallback(async (
    signingMethod?: string
  ): Promise<PublicKeyResponse | null> => {
    try {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      abortControllerRef.current = new AbortController()

      setIsLoadingPublicKey(true)
      setPublicKeyError(null)
      setPublicKeyData(null)

      const cleanupProgress = simulateProgress(600)
      
      const request: PublicKeyRequest = { signing_method: signingMethod }
      setLastPublicKeyRequest(request)

      const response: ApiResponse<PublicKeyResponse> = await apiClientRef.current.getPublicKey(request)

      // Complete progress
      setProgress(100)
      cleanupProgress()

      if (response.success && response.data) {
        setPublicKeyData(response.data)
        options.onPublicKeySuccess?.(response.data)
        return response.data
      } else if (response.error) {
        setPublicKeyError(response.error)
        options.onError?.(response.error)
        return null
      } else {
        const unknownError: ApiError = {
          status: 500,
          message: 'Unknown error occurred while fetching public key',
          timestamp: new Date()
        }
        setPublicKeyError(unknownError)
        options.onError?.(unknownError)
        return null
      }

    } catch (err) {
      const apiError: ApiError = {
        status: 0,
        message: err instanceof Error ? err.message : 'Public key request failed',
        timestamp: new Date()
      }
      setPublicKeyError(apiError)
      options.onError?.(apiError)
      return null
    } finally {
      setIsLoadingPublicKey(false)
      setProgress(0)
      abortControllerRef.current = null
    }
  }, [options, simulateProgress])

  const retryVerification = useCallback(async (): Promise<VerifySignatureResponse | null> => {
    if (!lastVerifyRequest) {
      const retryError: ApiError = {
        status: 400,
        message: 'No previous verification request to retry',
        timestamp: new Date()
      }
      setVerificationError(retryError)
      return null
    }

    return verifySignature(lastVerifyRequest)
  }, [lastVerifyRequest, verifySignature])

  const retryPublicKey = useCallback(async (): Promise<PublicKeyResponse | null> => {
    if (!lastPublicKeyRequest) {
      const retryError: ApiError = {
        status: 400,
        message: 'No previous public key request to retry',
        timestamp: new Date()
      }
      setPublicKeyError(retryError)
      return null
    }

    return getPublicKey(lastPublicKeyRequest.signing_method)
  }, [lastPublicKeyRequest, getPublicKey])

  const reset = useCallback(() => {
    setVerificationData(null)
    setVerificationError(null)
    setPublicKeyData(null)
    setPublicKeyError(null)
    setProgress(0)
    setLastVerifyRequest(null)
    setLastPublicKeyRequest(null)
    
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
    
    setIsVerifying(false)
    setIsLoadingPublicKey(false)
    setProgress(0)
  }, [])

  const canRetryVerification = Boolean(lastVerifyRequest && verificationError && !isVerifying)
  const canRetryPublicKey = Boolean(lastPublicKeyRequest && publicKeyError && !isLoadingPublicKey)
  const isLoading = isVerifying || isLoadingPublicKey
  const hasError = Boolean(verificationError || publicKeyError)

  return {
    // Verification state
    verificationData,
    isVerifying,
    verificationError,

    // Public key state
    publicKeyData,
    isLoadingPublicKey,
    publicKeyError,

    // Progress
    progress,

    // Actions
    verifySignature,
    getPublicKey,
    reset,
    cancel,

    // Utilities
    canRetryVerification,
    canRetryPublicKey,
    retryVerification,
    retryPublicKey,

    // Combined state
    isLoading,
    hasError
  }
}

export default useVerify