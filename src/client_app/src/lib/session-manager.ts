import { getApiClient } from './api-client'

export interface SessionData {
  id: string
  createdAt: Date
  lastUsedAt: Date
  expiresAt?: Date
  isValid: boolean
  metadata?: Record<string, unknown>
}

export interface SessionConfig {
  storageKey?: string
  expirationHours?: number
  autoRefresh?: boolean
  refreshThresholdMinutes?: number
}

export class SessionManager {
  private config: Required<SessionConfig>
  private currentSession: SessionData | null = null
  private refreshTimeout: NodeJS.Timeout | null = null

  constructor(config: SessionConfig = {}) {
    this.config = {
      storageKey: config.storageKey ?? 'pii-tee-session',
      expirationHours: config.expirationHours ?? 24,
      autoRefresh: config.autoRefresh ?? true,
      refreshThresholdMinutes: config.refreshThresholdMinutes ?? 30
    }

    // Load existing session on initialization
    this.loadSession()
  }

  /**
   * Generate a new session ID
   */
  private generateSessionId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Calculate expiration time based on configuration
   */
  private calculateExpiration(): Date {
    return new Date(Date.now() + this.config.expirationHours * 60 * 60 * 1000)
  }

  /**
   * Check if a session is expired
   */
  private isSessionExpired(session: SessionData): boolean {
    if (!session.expiresAt) return false
    return new Date() > session.expiresAt
  }

  /**
   * Check if a session needs refresh (within threshold of expiration)
   */
  private needsRefresh(session: SessionData): boolean {
    if (!session.expiresAt || !this.config.autoRefresh) return false
    
    const thresholdMs = this.config.refreshThresholdMinutes * 60 * 1000
    const timeToExpiry = session.expiresAt.getTime() - Date.now()
    
    return timeToExpiry <= thresholdMs
  }

  /**
   * Save session to storage
   */
  private saveSession(session: SessionData): void {
    try {
      const sessionData = {
        ...session,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt?.toISOString()
      }
      
      localStorage.setItem(this.config.storageKey, JSON.stringify(sessionData))
    } catch (error) {
      console.warn('Failed to save session to localStorage:', error)
      
      // Fallback to sessionStorage
      try {
        const sessionData = {
          ...session,
          createdAt: session.createdAt.toISOString(),
          lastUsedAt: session.lastUsedAt.toISOString(),
          expiresAt: session.expiresAt?.toISOString()
        }
        
        sessionStorage.setItem(this.config.storageKey, JSON.stringify(sessionData))
      } catch (fallbackError) {
        console.error('Failed to save session to sessionStorage:', fallbackError)
      }
    }
  }

  /**
   * Load session from storage
   */
  private loadSession(): SessionData | null {
    try {
      // Try localStorage first
      let storedData = localStorage.getItem(this.config.storageKey)
      
      // Fallback to sessionStorage
      if (!storedData) {
        storedData = sessionStorage.getItem(this.config.storageKey)
      }
      
      if (!storedData) return null

      const sessionData = JSON.parse(storedData)
      
      const session: SessionData = {
        ...sessionData,
        createdAt: new Date(sessionData.createdAt),
        lastUsedAt: new Date(sessionData.lastUsedAt),
        expiresAt: sessionData.expiresAt ? new Date(sessionData.expiresAt) : undefined
      }

      // Check if session is expired
      if (this.isSessionExpired(session)) {
        console.log('Loaded session is expired, clearing...')
        this.clearSession()
        return null
      }

      // Check if session needs refresh
      if (this.needsRefresh(session)) {
        console.log('Session needs refresh, scheduling refresh...')
        this.scheduleRefresh()
      }

      this.currentSession = session
      return session

    } catch (error) {
      console.error('Failed to load session from storage:', error)
      this.clearSession()
      return null
    }
  }

  /**
   * Clear session from storage
   */
  private clearSession(): void {
    try {
      localStorage.removeItem(this.config.storageKey)
      sessionStorage.removeItem(this.config.storageKey)
    } catch (error) {
      console.error('Failed to clear session from storage:', error)
    }
    
    this.currentSession = null
    
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
      this.refreshTimeout = null
    }
  }

  /**
   * Schedule session refresh
   */
  private scheduleRefresh(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }

    // Refresh in 1 minute
    this.refreshTimeout = setTimeout(() => {
      this.refreshSession()
    }, 60000)
  }

  /**
   * Refresh current session by extending expiration
   */
  private async refreshSession(): Promise<void> {
    if (!this.currentSession) return

    try {
      // Test if session is still valid with backend
      const apiClient = getApiClient()
      const healthCheck = await apiClient.healthCheck()

      if (healthCheck.success) {
        // Extend session expiration
        this.currentSession.lastUsedAt = new Date()
        this.currentSession.expiresAt = this.calculateExpiration()
        
        this.saveSession(this.currentSession)
        
        console.log('Session refreshed successfully')
        
        // Schedule next refresh if needed
        if (this.needsRefresh(this.currentSession)) {
          this.scheduleRefresh()
        }
      } else {
        console.warn('Session refresh failed, health check unsuccessful')
        this.clearSession()
      }
    } catch (error) {
      console.error('Failed to refresh session:', error)
      // Don't clear session on network errors, retry later
      this.scheduleRefresh()
    }
  }

  /**
   * Create a new session
   */
  public async createSession(metadata?: Record<string, unknown>): Promise<SessionData> {
    const now = new Date()
    
    const session: SessionData = {
      id: this.generateSessionId(),
      createdAt: now,
      lastUsedAt: now,
      expiresAt: this.calculateExpiration(),
      isValid: true,
      metadata
    }

    this.currentSession = session
    this.saveSession(session)

    console.log('New session created:', session.id)

    // Schedule refresh if needed
    if (this.needsRefresh(session)) {
      this.scheduleRefresh()
    }

    return session
  }

  /**
   * Get current session or create new one
   */
  public async getSession(autoCreate = true): Promise<SessionData | null> {
    // Return current session if valid
    if (this.currentSession && !this.isSessionExpired(this.currentSession)) {
      // Update last used time
      this.currentSession.lastUsedAt = new Date()
      this.saveSession(this.currentSession)
      return this.currentSession
    }

    // Try to load from storage
    const loadedSession = this.loadSession()
    if (loadedSession && !this.isSessionExpired(loadedSession)) {
      return loadedSession
    }

    // Create new session if auto-create is enabled
    if (autoCreate) {
      return await this.createSession()
    }

    return null
  }

  /**
   * Get session ID only (for API calls)
   */
  public async getSessionId(autoCreate = true): Promise<string | null> {
    const session = await this.getSession(autoCreate)
    return session?.id ?? null
  }

  /**
   * Update session metadata
   */
  public updateSessionMetadata(metadata: Record<string, unknown>): void {
    if (!this.currentSession) return

    this.currentSession.metadata = {
      ...this.currentSession.metadata,
      ...metadata
    }
    this.currentSession.lastUsedAt = new Date()
    
    this.saveSession(this.currentSession)
  }

  /**
   * Validate current session
   */
  public async validateSession(): Promise<boolean> {
    const session = await this.getSession(false)
    if (!session) return false

    // Check expiration
    if (this.isSessionExpired(session)) {
      this.clearSession()
      return false
    }

    try {
      // Validate with backend (optional health check)
      const apiClient = getApiClient()
      const result = await apiClient.healthCheck()
      
      if (!result.success) {
        console.warn('Session validation failed via health check')
        return false
      }

      return true
    } catch (error) {
      console.error('Session validation error:', error)
      // Don't invalidate on network errors
      return true
    }
  }

  /**
   * Destroy current session
   */
  public destroySession(): void {
    console.log('Destroying session:', this.currentSession?.id)
    this.clearSession()
  }

  /**
   * Get session info for debugging
   */
  public getSessionInfo(): SessionData | null {
    return this.currentSession ? { ...this.currentSession } : null
  }

  /**
   * Check if session exists and is valid
   */
  public hasValidSession(): boolean {
    return this.currentSession !== null && 
           this.currentSession.isValid && 
           !this.isSessionExpired(this.currentSession)
  }

  /**
   * Update session configuration
   */
  public updateConfig(newConfig: Partial<SessionConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    }

    // Restart refresh scheduling if auto-refresh setting changed
    if (newConfig.autoRefresh !== undefined) {
      if (this.refreshTimeout) {
        clearTimeout(this.refreshTimeout)
        this.refreshTimeout = null
      }

      if (newConfig.autoRefresh && this.currentSession && this.needsRefresh(this.currentSession)) {
        this.scheduleRefresh()
      }
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
      this.refreshTimeout = null
    }
  }
}

// Default session manager instance
let defaultSessionManager: SessionManager | null = null

/**
 * Get the default session manager instance
 */
export function getSessionManager(config?: SessionConfig): SessionManager {
  if (!defaultSessionManager || config) {
    defaultSessionManager = new SessionManager(config)
  }
  return defaultSessionManager
}

/**
 * Set a custom default session manager
 */
export function setSessionManager(manager: SessionManager): void {
  defaultSessionManager = manager
}

export default SessionManager