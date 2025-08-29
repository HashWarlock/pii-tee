import { ApiError } from '@/types/api'
import { getApiClient } from './api-client'
import { getSessionManager } from './session-manager'

export interface RecoveryAction {
  id: string
  label: string
  description: string
  action: () => Promise<boolean>
  priority: 'high' | 'medium' | 'low'
}

export interface RecoveryStrategy {
  errorType: string
  actions: RecoveryAction[]
}

export class ErrorRecoveryService {
  private strategies: Map<string, RecoveryStrategy> = new Map()

  constructor() {
    this.initializeDefaultStrategies()
  }

  private initializeDefaultStrategies(): void {
    // Network error recovery
    this.strategies.set('network', {
      errorType: 'Network Error',
      actions: [
        {
          id: 'health-check',
          label: 'Test Connection',
          description: 'Check if the server is reachable',
          priority: 'high',
          action: async () => {
            try {
              const client = getApiClient()
              const result = await client.healthCheck()
              return result.success
            } catch {
              return false
            }
          }
        },
        {
          id: 'reconnect',
          label: 'Reconnect',
          description: 'Attempt to re-establish connection',
          priority: 'high',
          action: async () => {
            // Wait a moment before retrying
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            try {
              const client = getApiClient()
              const result = await client.healthCheck()
              return result.success
            } catch {
              return false
            }
          }
        }
      ]
    })

    // Session error recovery
    this.strategies.set('session', {
      errorType: 'Session Error',
      actions: [
        {
          id: 'refresh-session',
          label: 'Refresh Session',
          description: 'Create a new session',
          priority: 'high',
          action: async () => {
            try {
              const sessionManager = getSessionManager()
              sessionManager.destroySession()
              const newSession = await sessionManager.createSession()
              return Boolean(newSession)
            } catch {
              return false
            }
          }
        },
        {
          id: 'clear-storage',
          label: 'Clear Storage',
          description: 'Clear stored session data',
          priority: 'medium',
          action: async () => {
            try {
              localStorage.removeItem('pii-tee-session')
              sessionStorage.removeItem('pii-tee-session')
              return true
            } catch {
              return false
            }
          }
        }
      ]
    })

    // Server error recovery
    this.strategies.set('server', {
      errorType: 'Server Error',
      actions: [
        {
          id: 'wait-retry',
          label: 'Wait and Retry',
          description: 'Wait for server to recover',
          priority: 'high',
          action: async () => {
            // Exponential backoff: wait 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000))
            
            try {
              const client = getApiClient()
              const result = await client.healthCheck()
              return result.success
            } catch {
              return false
            }
          }
        },
        {
          id: 'check-status',
          label: 'Check Server Status',
          description: 'Verify server availability',
          priority: 'medium',
          action: async () => {
            try {
              // Try a simple endpoint to check if server is responding
              const response = await fetch('/health', { method: 'HEAD' })
              return response.ok
            } catch {
              return false
            }
          }
        }
      ]
    })

    // Client error recovery
    this.strategies.set('client', {
      errorType: 'Request Error',
      actions: [
        {
          id: 'validate-input',
          label: 'Check Input',
          description: 'Verify request parameters',
          priority: 'high',
          action: async () => {
            // This would be implemented per-request
            // For now, just indicate that manual review is needed
            return false
          }
        },
        {
          id: 'reset-form',
          label: 'Reset Form',
          description: 'Clear form data and start over',
          priority: 'medium',
          action: async () => {
            // This would trigger a form reset in the component
            return true
          }
        }
      ]
    })

    // Timeout error recovery
    this.strategies.set('timeout', {
      errorType: 'Timeout Error',
      actions: [
        {
          id: 'extend-timeout',
          label: 'Increase Timeout',
          description: 'Allow more time for request',
          priority: 'high',
          action: async () => {
            try {
              const client = getApiClient()
              client.updateConfig({ timeout: 60000 }) // 60 seconds
              return true
            } catch {
              return false
            }
          }
        },
        {
          id: 'reduce-load',
          label: 'Reduce Request Size',
          description: 'Try with smaller data',
          priority: 'medium',
          action: async () => {
            // This would be implemented per-request
            return false
          }
        }
      ]
    })
  }

  /**
   * Get recovery strategy for an error
   */
  public getRecoveryStrategy(error: ApiError): RecoveryStrategy | null {
    // Determine error type based on status code
    let strategyKey: string

    if (error.status === 0) {
      strategyKey = 'network'
    } else if (error.status === 408 || error.status === 504) {
      strategyKey = 'timeout'
    } else if (error.status === 401 || error.status === 403) {
      strategyKey = 'session'
    } else if (error.status >= 500) {
      strategyKey = 'server'
    } else if (error.status >= 400 && error.status < 500) {
      strategyKey = 'client'
    } else {
      return null
    }

    return this.strategies.get(strategyKey) || null
  }

  /**
   * Get suggested actions for an error
   */
  public getSuggestedActions(error: ApiError): RecoveryAction[] {
    const strategy = this.getRecoveryStrategy(error)
    if (!strategy) return []

    // Sort by priority
    return strategy.actions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * Execute recovery action
   */
  public async executeRecoveryAction(actionId: string, error: ApiError): Promise<boolean> {
    const actions = this.getSuggestedActions(error)
    const action = actions.find(a => a.id === actionId)
    
    if (!action) {
      console.warn(`Recovery action ${actionId} not found for error`, error)
      return false
    }

    try {
      console.log(`Executing recovery action: ${action.label}`)
      const success = await action.action()
      console.log(`Recovery action ${action.label} ${success ? 'succeeded' : 'failed'}`)
      return success
    } catch (err) {
      console.error(`Recovery action ${action.label} threw error:`, err)
      return false
    }
  }

  /**
   * Auto-recover from error (tries actions in priority order)
   */
  public async autoRecover(error: ApiError): Promise<boolean> {
    const actions = this.getSuggestedActions(error)
    
    if (actions.length === 0) {
      console.warn('No recovery actions available for error', error)
      return false
    }

    for (const action of actions) {
      if (action.priority === 'high') {
        console.log(`Attempting auto-recovery with: ${action.label}`)
        
        try {
          const success = await action.action()
          if (success) {
            console.log(`Auto-recovery succeeded with: ${action.label}`)
            return true
          }
        } catch (err) {
          console.error(`Auto-recovery action ${action.label} failed:`, err)
        }
      }
    }

    console.log('Auto-recovery failed, manual intervention may be needed')
    return false
  }

  /**
   * Add custom recovery strategy
   */
  public addStrategy(key: string, strategy: RecoveryStrategy): void {
    this.strategies.set(key, strategy)
  }

  /**
   * Update existing strategy
   */
  public updateStrategy(key: string, updates: Partial<RecoveryStrategy>): void {
    const existing = this.strategies.get(key)
    if (existing) {
      this.strategies.set(key, { ...existing, ...updates })
    }
  }

  /**
   * Get all available strategies
   */
  public getAllStrategies(): Map<string, RecoveryStrategy> {
    return new Map(this.strategies)
  }

  /**
   * Get human-readable error advice
   */
  public getErrorAdvice(error: ApiError): string[] {
    const actions = this.getSuggestedActions(error)
    return actions.map(action => action.description)
  }
}

// Default instance
let defaultErrorRecovery: ErrorRecoveryService | null = null

/**
 * Get the default error recovery service
 */
export function getErrorRecoveryService(): ErrorRecoveryService {
  if (!defaultErrorRecovery) {
    defaultErrorRecovery = new ErrorRecoveryService()
  }
  return defaultErrorRecovery
}

export default ErrorRecoveryService