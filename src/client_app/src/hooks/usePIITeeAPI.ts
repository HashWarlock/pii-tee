import { useState, useCallback, useRef, useEffect } from 'react'
import { useAnonymize } from './useAnonymize'
import { useDeanonymize } from './useDeanonymize'
import { useVerify } from './useVerify'
import { useSession } from './useSession'
import { getApiClient } from '@/lib/api-client'
import {
  AnonymizeResponse,
  DeanonymizeResponse,
  VerifySignatureResponse,
  PublicKeyResponse,
  ApiError
} from '@/types/api'

export interface PIIWorkflowData {
  originalText: string
  anonymizedText: string
  deanonymizedText?: string
  sessionId: string
  quote?: string
  signature?: string
  publicKey?: string
  signingMethod?: string
  verificationResult?: VerifySignatureResponse
}

export interface UsePIITeeAPIOptions {
  autoCreateSession?: boolean
  defaultLanguage?: string
  onWorkflowComplete?: (data: PIIWorkflowData) => void
  onError?: (error: ApiError) => void
}

export interface UsePIITeeAPIReturn {
  // Combined state
  isLoading: boolean
  hasError: boolean
  progress: number
  currentStep: string | null

  // Session management
  session: ReturnType<typeof useSession>

  // Individual operations
  anonymize: ReturnType<typeof useAnonymize>
  deanonymize: ReturnType<typeof useDeanonymize>
  verify: ReturnType<typeof useVerify>

  // Workflow actions
  processText: (text: string, options?: { language?: string }) => Promise<PIIWorkflowData | null>
  verifyWorkflow: (workflowData: PIIWorkflowData) => Promise<boolean>
  resetAll: () => void

  // Utilities
  getHealthStatus: () => Promise<boolean>
  workflow: PIIWorkflowData | null
}

export function usePIITeeAPI(options: UsePIITeeAPIOptions = {}): UsePIITeeAPIReturn {
  const [workflow, setWorkflow] = useState<PIIWorkflowData | null>(null)
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null)

  const apiClientRef = useRef(getApiClient())
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Session management
  const session = useSession({
    expirationHours: 24,
    autoRefresh: true
  })

  // Individual API operations
  const anonymize = useAnonymize({
    defaultLanguage: options.defaultLanguage,
    onSuccess: (response) => {
      console.log('Anonymization successful:', response.session_id)
    },
    onError: options.onError
  })

  const deanonymize = useDeanonymize({
    onSuccess: (response) => {
      console.log('Deanonymization successful')
    },
    onError: options.onError
  })

  const verify = useVerify({
    onSuccess: (response) => {
      console.log('Verification successful:', response.data.is_valid)
    },
    onError: options.onError
  })

  // Health check functionality
  const getHealthStatus = useCallback(async (): Promise<boolean> => {
    try {
      const healthResponse = await apiClientRef.current.healthCheck()
      const healthy = healthResponse.success
      setIsHealthy(healthy)
      return healthy
    } catch (error) {
      setIsHealthy(false)
      return false
    }
  }, [])

  // Set up periodic health checks
  useEffect(() => {
    getHealthStatus() // Initial check

    healthCheckIntervalRef.current = setInterval(() => {
      getHealthStatus()
    }, 30000) // Check every 30 seconds

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
    }
  }, [getHealthStatus])

  // Process text through full anonymization workflow
  const processText = useCallback(async (
    text: string,
    requestOptions: { language?: string } = {}
  ): Promise<PIIWorkflowData | null> => {
    try {
      setCurrentStep('Initializing session...')
      
      // Ensure we have a valid session
      if (!session.hasValidSession && (options.autoCreateSession ?? true)) {
        await session.createSession()
      }
      const currentSession = session.session
      if (!currentSession) {
        throw new Error('Failed to create or retrieve session')
      }

      setCurrentStep('Anonymizing text...')
      
      // Step 1: Anonymize the text
      const anonymizeResult = await anonymize.anonymize(
        text,
        requestOptions.language || 'en',
        currentSession.id
      )

      if (!anonymizeResult || !anonymizeResult.success || !anonymizeResult.data) {
        throw new Error('Anonymization failed')
      }

      setCurrentStep('Building workflow data...')
      
      // Create workflow data
      const workflowData: PIIWorkflowData = {
        originalText: text,
        anonymizedText: anonymizeResult.data.text,
        sessionId: anonymizeResult.data.session_id,
        quote: anonymizeResult.data.quote,
        signature: anonymizeResult.data.signature,
        publicKey: anonymizeResult.data.public_key,
        signingMethod: anonymizeResult.data.signing_method
      }

      setWorkflow(workflowData)
      setCurrentStep('Workflow complete')
      
      options.onWorkflowComplete?.(workflowData)

      setTimeout(() => setCurrentStep(null), 2000) // Clear step after 2 seconds

      return workflowData

    } catch (error) {
      const apiError: ApiError = {
        status: 500,
        message: error instanceof Error ? error.message : 'Workflow processing failed',
        timestamp: new Date()
      }
      
      options.onError?.(apiError)
      setCurrentStep(null)
      return null
    }
  }, [session, anonymize, options])

  // Verify complete workflow
  const verifyWorkflow = useCallback(async (workflowData: PIIWorkflowData): Promise<boolean> => {
    if (!workflowData.signature || !workflowData.publicKey || !workflowData.signingMethod) {
      console.warn('Workflow data missing required fields for verification')
      return false
    }

    try {
      setCurrentStep('Verifying signature...')

      const verificationResult = await verify.verifySignature({
        content: workflowData.anonymizedText,
        signature: workflowData.signature,
        public_key: workflowData.publicKey,
        signing_method: workflowData.signingMethod
      })

      if (verificationResult) {
        setWorkflow(prev => prev ? {
          ...prev,
          verificationResult
        } : null)

        const isValid = verificationResult.data.is_valid === true
        setCurrentStep(isValid ? 'Verification successful' : 'Verification failed')
        
        setTimeout(() => setCurrentStep(null), 2000)
        
        return isValid
      }

      setCurrentStep('Verification failed')
      setTimeout(() => setCurrentStep(null), 2000)
      return false

    } catch (error) {
      const apiError: ApiError = {
        status: 500,
        message: error instanceof Error ? error.message : 'Workflow verification failed',
        timestamp: new Date()
      }
      
      options.onError?.(apiError)
      setCurrentStep(null)
      return false
    }
  }, [verify, options])

  // Reset all operations
  const resetAll = useCallback(() => {
    anonymize.reset()
    deanonymize.reset()
    verify.reset()
    setWorkflow(null)
    setCurrentStep(null)
  }, [anonymize, deanonymize, verify])

  // Calculate combined loading state
  const isLoading = anonymize.isLoading || 
                    deanonymize.isLoading || 
                    verify.isLoading || 
                    session.isLoading

  // Calculate combined error state
  const hasError = Boolean(
    anonymize.error || 
    deanonymize.error || 
    verify.hasError || 
    session.error
  )

  // Calculate combined progress
  const progress = Math.max(
    anonymize.progress,
    deanonymize.progress,
    verify.progress
  )

  return {
    // Combined state
    isLoading,
    hasError,
    progress,
    currentStep,

    // Session management
    session,

    // Individual operations
    anonymize,
    deanonymize,
    verify,

    // Workflow actions
    processText,
    verifyWorkflow,
    resetAll,

    // Utilities
    getHealthStatus,
    workflow
  }
}

export default usePIITeeAPI