import { useCallback, useEffect, useRef, useState } from 'react'

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error' | 'recovering'

export interface ConnectionRecoveryConfig {
  maxRetries?: number
  retryDelay?: number
  maxRetryDelay?: number
  backoffMultiplier?: number
  healthCheckInterval?: number
  fallbackMode?: boolean
}

export interface RecoveryAttempt {
  attempt: number
  timestamp: Date
  error?: string
  successful?: boolean
  duration?: number
}

export interface UseConnectionRecoveryReturn {
  state: ConnectionState
  isRecovering: boolean
  retryCount: number
  lastError: string | null
  recoveryHistory: RecoveryAttempt[]
  
  // Actions
  triggerRecovery: () => void
  forceReconnect: () => void
  enableFallback: () => void
  disableFallback: () => void
  reset: () => void
  
  // Health check
  isHealthy: () => Promise<boolean>
  getRecoveryStatus: () => string
}

export function useConnectionRecovery(
  connectionCheck: () => Promise<boolean>,
  onRecover: () => Promise<void>,
  config: ConnectionRecoveryConfig = {}
): UseConnectionRecoveryReturn {
  const {
    maxRetries = 5,
    retryDelay = 1000,
    maxRetryDelay = 30000,
    backoffMultiplier = 2,
    healthCheckInterval = 30000,
    fallbackMode = false
  } = config

  const [state, setState] = useState<ConnectionState>('disconnected')
  const [retryCount, setRetryCount] = useState(0)
  const [lastError, setLastError] = useState<string | null>(null)
  const [recoveryHistory, setRecoveryHistory] = useState<RecoveryAttempt[]>([])
  const [fallbackEnabled, setFallbackEnabled] = useState(fallbackMode)

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRecoveringRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Calculate next retry delay with exponential backoff
  const getRetryDelay = useCallback((attempt: number) => {
    const delay = Math.min(
      retryDelay * Math.pow(backoffMultiplier, attempt),
      maxRetryDelay
    )
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000
  }, [retryDelay, backoffMultiplier, maxRetryDelay])

  // Check if connection is healthy
  const isHealthy = useCallback(async (): Promise<boolean> => {
    try {
      return await connectionCheck()
    } catch (error) {
      console.warn('[Recovery] Health check failed:', error)
      return false
    }
  }, [connectionCheck])

  // Add recovery attempt to history
  const addRecoveryAttempt = useCallback((attempt: RecoveryAttempt) => {
    setRecoveryHistory(prev => {
      const newHistory = [...prev, attempt]
      // Keep only last 10 attempts
      return newHistory.slice(-10)
    })
  }, [])

  // Perform recovery attempt
  const performRecovery = useCallback(async (attemptNumber: number): Promise<boolean> => {
    const startTime = Date.now()
    const attempt: RecoveryAttempt = {
      attempt: attemptNumber,
      timestamp: new Date()
    }

    try {
      console.log(`[Recovery] Attempt ${attemptNumber}/${maxRetries}`)
      setState('recovering')
      
      // Abort any ongoing recovery
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      // Check if we can connect
      const isConnected = await connectionCheck()
      
      if (isConnected) {
        // Connection is good, attempt recovery
        await onRecover()
        
        const duration = Date.now() - startTime
        attempt.successful = true
        attempt.duration = duration
        addRecoveryAttempt(attempt)
        
        console.log(`[Recovery] Success after ${duration}ms`)
        setState('connected')
        setLastError(null)
        setRetryCount(0)
        return true
      } else {
        throw new Error('Connection check failed')
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      attempt.successful = false
      attempt.duration = duration
      attempt.error = errorMessage
      addRecoveryAttempt(attempt)
      
      console.error(`[Recovery] Attempt ${attemptNumber} failed after ${duration}ms:`, error)
      setLastError(errorMessage)
      
      return false
    }
  }, [connectionCheck, onRecover, maxRetries, addRecoveryAttempt])

  // Main recovery function
  const triggerRecovery = useCallback(async () => {
    if (isRecoveringRef.current) {
      console.log('[Recovery] Already recovering, skipping')
      return
    }

    if (retryCount >= maxRetries) {
      console.log('[Recovery] Max retries exceeded')
      setState(fallbackEnabled ? 'connected' : 'error')
      return
    }

    isRecoveringRef.current = true
    const currentAttempt = retryCount + 1

    try {
      const success = await performRecovery(currentAttempt)
      
      if (success) {
        isRecoveringRef.current = false
        return
      }

      // Recovery failed, schedule next attempt
      setRetryCount(currentAttempt)
      
      if (currentAttempt >= maxRetries) {
        console.log('[Recovery] Max retries reached')
        setState(fallbackEnabled ? 'connected' : 'error')
        isRecoveringRef.current = false
        return
      }

      // Schedule next retry
      const delay = getRetryDelay(currentAttempt)
      console.log(`[Recovery] Scheduling retry ${currentAttempt + 1} in ${delay}ms`)
      
      setState('disconnected')
      retryTimeoutRef.current = setTimeout(() => {
        isRecoveringRef.current = false
        triggerRecovery()
      }, delay)

    } catch (error) {
      console.error('[Recovery] Recovery process failed:', error)
      setState('error')
      isRecoveringRef.current = false
    }
  }, [retryCount, maxRetries, performRecovery, getRetryDelay, fallbackEnabled])

  // Force immediate reconnect
  const forceReconnect = useCallback(() => {
    console.log('[Recovery] Force reconnect requested')
    
    // Clear any pending retries
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }
    
    // Reset state
    setRetryCount(0)
    setLastError(null)
    setState('connecting')
    isRecoveringRef.current = false
    
    // Trigger immediate recovery
    setTimeout(triggerRecovery, 100)
  }, [triggerRecovery])

  // Enable fallback mode
  const enableFallback = useCallback(() => {
    console.log('[Recovery] Fallback mode enabled')
    setFallbackEnabled(true)
    if (state === 'error') {
      setState('connected')
    }
  }, [state])

  // Disable fallback mode
  const disableFallback = useCallback(() => {
    console.log('[Recovery] Fallback mode disabled')
    setFallbackEnabled(false)
  }, [])

  // Reset recovery state
  const reset = useCallback(() => {
    console.log('[Recovery] Reset requested')
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    setRetryCount(0)
    setLastError(null)
    setRecoveryHistory([])
    setState('disconnected')
    isRecoveringRef.current = false
  }, [])

  // Get human-readable recovery status
  const getRecoveryStatus = useCallback((): string => {
    switch (state) {
      case 'connected':
        return fallbackEnabled ? 'Connected (Fallback Mode)' : 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'recovering':
        return `Recovering... (Attempt ${retryCount + 1}/${maxRetries})`
      case 'disconnected':
        return retryCount > 0 ? `Disconnected (${retryCount} retries)` : 'Disconnected'
      case 'error':
        return `Connection Failed (${retryCount}/${maxRetries} retries)`
      default:
        return 'Unknown'
    }
  }, [state, retryCount, maxRetries, fallbackEnabled])

  // Start health checking when connected
  useEffect(() => {
    if (state === 'connected' && healthCheckInterval > 0) {
      healthCheckIntervalRef.current = setInterval(async () => {
        const healthy = await isHealthy()
        if (!healthy && !isRecoveringRef.current) {
          console.log('[Recovery] Health check failed, triggering recovery')
          triggerRecovery()
        }
      }, healthCheckInterval)
    }

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
    }
  }, [state, healthCheckInterval, isHealthy, triggerRecovery])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    state,
    isRecovering: state === 'recovering',
    retryCount,
    lastError,
    recoveryHistory,
    triggerRecovery,
    forceReconnect,
    enableFallback,
    disableFallback,
    reset,
    isHealthy,
    getRecoveryStatus
  }
}