import { useState, useCallback, useRef } from 'react'
import { getErrorRecoveryService, type RecoveryAction } from '@/lib/error-recovery'
import { ApiError } from '@/types/api'

export interface UseErrorRecoveryReturn {
  // State
  isRecovering: boolean
  recoveryHistory: Array<{
    actionId: string
    success: boolean
    timestamp: Date
    error?: string
  }>
  
  // Actions
  getSuggestedActions: (error: ApiError) => RecoveryAction[]
  executeAction: (actionId: string, error: ApiError) => Promise<boolean>
  autoRecover: (error: ApiError) => Promise<boolean>
  clearHistory: () => void
  
  // Utilities
  getErrorAdvice: (error: ApiError) => string[]
  canAutoRecover: (error: ApiError) => boolean
}

export function useErrorRecovery(): UseErrorRecoveryReturn {
  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryHistory, setRecoveryHistory] = useState<Array<{
    actionId: string
    success: boolean
    timestamp: Date
    error?: string
  }>>([])
  
  const recoveryServiceRef = useRef(getErrorRecoveryService())

  const getSuggestedActions = useCallback((error: ApiError): RecoveryAction[] => {
    return recoveryServiceRef.current.getSuggestedActions(error)
  }, [])

  const executeAction = useCallback(async (actionId: string, error: ApiError): Promise<boolean> => {
    setIsRecovering(true)
    
    try {
      const success = await recoveryServiceRef.current.executeRecoveryAction(actionId, error)
      
      // Log to history
      setRecoveryHistory(prev => [...prev, {
        actionId,
        success,
        timestamp: new Date()
      }].slice(-10)) // Keep last 10 entries
      
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      
      // Log failed attempt
      setRecoveryHistory(prev => [...prev, {
        actionId,
        success: false,
        timestamp: new Date(),
        error: errorMessage
      }].slice(-10))
      
      return false
    } finally {
      setIsRecovering(false)
    }
  }, [])

  const autoRecover = useCallback(async (error: ApiError): Promise<boolean> => {
    setIsRecovering(true)
    
    try {
      const success = await recoveryServiceRef.current.autoRecover(error)
      
      // Log auto-recovery attempt
      setRecoveryHistory(prev => [...prev, {
        actionId: 'auto-recover',
        success,
        timestamp: new Date()
      }].slice(-10))
      
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      
      setRecoveryHistory(prev => [...prev, {
        actionId: 'auto-recover',
        success: false,
        timestamp: new Date(),
        error: errorMessage
      }].slice(-10))
      
      return false
    } finally {
      setIsRecovering(false)
    }
  }, [])

  const clearHistory = useCallback(() => {
    setRecoveryHistory([])
  }, [])

  const getErrorAdvice = useCallback((error: ApiError): string[] => {
    return recoveryServiceRef.current.getErrorAdvice(error)
  }, [])

  const canAutoRecover = useCallback((error: ApiError): boolean => {
    const actions = getSuggestedActions(error)
    return actions.some(action => action.priority === 'high')
  }, [getSuggestedActions])

  return {
    // State
    isRecovering,
    recoveryHistory,
    
    // Actions
    getSuggestedActions,
    executeAction,
    autoRecover,
    clearHistory,
    
    // Utilities
    getErrorAdvice,
    canAutoRecover
  }
}

export default useErrorRecovery