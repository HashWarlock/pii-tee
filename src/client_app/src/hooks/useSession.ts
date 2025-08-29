import { useState, useEffect, useCallback, useRef } from 'react'
import { getSessionManager, type SessionData, type SessionConfig } from '@/lib/session-manager'

export interface UseSessionReturn {
  // Session state
  session: SessionData | null
  sessionId: string | null
  isLoading: boolean
  error: string | null
  hasValidSession: boolean

  // Session actions
  createSession: (metadata?: Record<string, unknown>) => Promise<void>
  refreshSession: () => Promise<void>
  validateSession: () => Promise<boolean>
  updateMetadata: (metadata: Record<string, unknown>) => void
  destroySession: () => void
  clearError: () => void

  // Session info
  getSessionInfo: () => SessionData | null
  isExpired: boolean
  timeUntilExpiration: number | null // in milliseconds
}

export function useSession(config?: SessionConfig): UseSessionReturn {
  const [session, setSession] = useState<SessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sessionManagerRef = useRef(getSessionManager(config))
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate session expiration info
  const isExpired = session ? new Date() > (session.expiresAt || new Date()) : false
  const timeUntilExpiration = session?.expiresAt 
    ? Math.max(0, session.expiresAt.getTime() - Date.now())
    : null

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const sessionData = await sessionManagerRef.current.getSession(true)
        setSession(sessionData)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load session'
        setError(errorMessage)
        console.error('Session loading error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadSession()

    // Set up periodic session refresh
    refreshIntervalRef.current = setInterval(() => {
      if (sessionManagerRef.current.hasValidSession()) {
        loadSession() // Refresh session data
      }
    }, 60000) // Check every minute

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      sessionManagerRef.current.dispose()
    }
  }, [])

  // Create new session
  const createSession = useCallback(async (metadata?: Record<string, unknown>) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const newSession = await sessionManagerRef.current.createSession(metadata)
      setSession(newSession)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session'
      setError(errorMessage)
      console.error('Session creation error:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Refresh current session
  const refreshSession = useCallback(async () => {
    try {
      setError(null)
      
      const sessionData = await sessionManagerRef.current.getSession(false)
      if (sessionData) {
        setSession(sessionData)
      } else {
        // Session no longer valid, create new one
        await createSession()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh session'
      setError(errorMessage)
      console.error('Session refresh error:', err)
    }
  }, [createSession])

  // Validate session
  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      setError(null)
      
      const isValid = await sessionManagerRef.current.validateSession()
      
      if (!isValid) {
        setSession(null)
        setError('Session is no longer valid')
      } else {
        // Refresh session data after successful validation
        const sessionData = await sessionManagerRef.current.getSession(false)
        setSession(sessionData)
      }
      
      return isValid
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Session validation failed'
      setError(errorMessage)
      console.error('Session validation error:', err)
      return false
    }
  }, [])

  // Update session metadata
  const updateMetadata = useCallback((metadata: Record<string, unknown>) => {
    try {
      sessionManagerRef.current.updateSessionMetadata(metadata)
      
      // Update local state
      if (session) {
        const updatedSession = {
          ...session,
          metadata: { ...session.metadata, ...metadata },
          lastUsedAt: new Date()
        }
        setSession(updatedSession)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update session metadata'
      setError(errorMessage)
      console.error('Session metadata update error:', err)
    }
  }, [session])

  // Destroy session
  const destroySession = useCallback(() => {
    try {
      sessionManagerRef.current.destroySession()
      setSession(null)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to destroy session'
      setError(errorMessage)
      console.error('Session destruction error:', err)
    }
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Get session info
  const getSessionInfo = useCallback((): SessionData | null => {
    return sessionManagerRef.current.getSessionInfo()
  }, [])

  return {
    // State
    session,
    sessionId: session?.id ?? null,
    isLoading,
    error,
    hasValidSession: sessionManagerRef.current.hasValidSession(),
    isExpired,
    timeUntilExpiration,

    // Actions
    createSession,
    refreshSession,
    validateSession,
    updateMetadata,
    destroySession,
    clearError,
    getSessionInfo
  }
}

// Specialized hook for getting session ID only (lighter weight)
export function useSessionId(autoCreate = true): {
  sessionId: string | null
  isLoading: boolean
  error: string | null
  refreshSessionId: () => Promise<void>
} {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sessionManagerRef = useRef(getSessionManager())

  const loadSessionId = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const id = await sessionManagerRef.current.getSessionId(autoCreate)
      setSessionId(id)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get session ID'
      setError(errorMessage)
      console.error('Session ID loading error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [autoCreate])

  useEffect(() => {
    loadSessionId()
  }, [loadSessionId])

  const refreshSessionId = useCallback(async () => {
    await loadSessionId()
  }, [loadSessionId])

  return {
    sessionId,
    isLoading,
    error,
    refreshSessionId
  }
}

export default useSession