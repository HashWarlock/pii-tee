import { useReducer, useCallback, useRef, useEffect } from 'react'
import { useConnectionRecovery, type ConnectionState } from './useConnectionRecovery'

// Streaming message states
interface StreamingMessage {
  id: string
  type: 'human' | 'llm'
  content: string
  isStreaming: boolean
  isComplete: boolean
  timestamp: Date
  sessionId?: string
  isAnonymized?: boolean
  originalContent?: string
  error?: string
}

// Chat state management
interface ChatState {
  messages: StreamingMessage[]
  currentStreamingId: string | null
  isConnected: boolean
  error: string | null
  sessionId: string | null
  connectionState: ConnectionState
  fallbackMode: boolean
}

type ChatAction =
  | { type: 'ADD_MESSAGE'; payload: StreamingMessage }
  | { type: 'START_STREAMING'; payload: { id: string; type: 'human' | 'llm'; timestamp: Date } }
  | { type: 'APPEND_CONTENT'; payload: { id: string; content: string } }
  | { type: 'COMPLETE_MESSAGE'; payload: { id: string; finalContent?: string } }
  | { type: 'SET_ERROR'; payload: { id?: string; error: string } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
  | { type: 'SET_CONNECTION_STATE'; payload: ConnectionState }
  | { type: 'SET_FALLBACK_MODE'; payload: boolean }
  | { type: 'RESET_CHAT' }

const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        error: null
      }

    case 'START_STREAMING':
      const newMessage: StreamingMessage = {
        id: action.payload.id,
        type: action.payload.type,
        content: '',
        isStreaming: true,
        isComplete: false,
        timestamp: action.payload.timestamp,
        sessionId: state.sessionId || undefined
      }
      return {
        ...state,
        messages: [...state.messages, newMessage],
        currentStreamingId: action.payload.id,
        error: null
      }

    case 'APPEND_CONTENT':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id
            ? { ...msg, content: msg.content + action.payload.content }
            : msg
        )
      }

    case 'COMPLETE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id
            ? {
                ...msg,
                content: action.payload.finalContent || msg.content,
                isStreaming: false,
                isComplete: true
              }
            : msg
        ),
        currentStreamingId: null
      }

    case 'SET_ERROR':
      if (action.payload.id) {
        return {
          ...state,
          messages: state.messages.map(msg =>
            msg.id === action.payload.id
              ? { ...msg, error: action.payload.error, isStreaming: false }
              : msg
          ),
          currentStreamingId: null
        }
      }
      return {
        ...state,
        error: action.payload.error,
        currentStreamingId: null
      }

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      }

    case 'SET_SESSION_ID':
      return {
        ...state,
        sessionId: action.payload
      }

    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload
      }

    case 'SET_CONNECTION_STATE':
      return {
        ...state,
        connectionState: action.payload,
        isConnected: action.payload === 'connected'
      }

    case 'SET_FALLBACK_MODE':
      return {
        ...state,
        fallbackMode: action.payload
      }

    case 'RESET_CHAT':
      return {
        messages: [],
        currentStreamingId: null,
        isConnected: false,
        error: null,
        sessionId: null,
        connectionState: 'disconnected',
        fallbackMode: false
      }

    default:
      return state
  }
}

const initialState: ChatState = {
  messages: [],
  currentStreamingId: null,
  isConnected: false,
  error: null,
  sessionId: null,
  connectionState: 'disconnected',
  fallbackMode: false
}

export interface UseStreamingChatReturn {
  // State
  messages: StreamingMessage[]
  isStreaming: boolean
  isConnected: boolean
  error: string | null
  sessionId: string | null
  connectionState: ConnectionState
  fallbackMode: boolean

  // Actions
  addMessage: (message: Omit<StreamingMessage, 'id' | 'timestamp'>) => void
  startStreaming: (type: 'human' | 'llm') => string
  appendContent: (id: string, content: string) => void
  completeMessage: (id: string, finalContent?: string) => void
  setError: (error: string, messageId?: string) => void
  clearError: () => void
  setSessionId: (sessionId: string) => void
  setConnectionStatus: (connected: boolean) => void
  setConnectionState: (state: ConnectionState) => void
  setFallbackMode: (enabled: boolean) => void
  resetChat: () => void

  // Recovery actions
  triggerRecovery: () => void
  forceReconnect: () => void
  
  // Utilities
  getCurrentStreamingMessage: () => StreamingMessage | null
  getConnectionStatus: () => string
}

export function useStreamingChat(): UseStreamingChatReturn {
  const [state, dispatch] = useReducer(chatReducer, initialState)
  const messageIdCounter = useRef(0)

  // Connection recovery hook
  const connectionRecovery = useConnectionRecovery(
    // Connection check function
    async () => {
      try {
        const response = await fetch('/api/health', { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        })
        return response.ok
      } catch {
        return false
      }
    },
    // Recovery function
    async () => {
      // Reset any failed streaming state and attempt to reconnect
      if (state.currentStreamingId) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: { 
            id: state.currentStreamingId, 
            error: 'Connection recovered, please retry your message' 
          }
        })
      }
    },
    {
      maxRetries: 3,
      retryDelay: 2000,
      maxRetryDelay: 10000,
      backoffMultiplier: 1.5,
      healthCheckInterval: 30000,
      fallbackMode: false
    }
  )

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return `msg-${Date.now()}-${++messageIdCounter.current}`
  }, [])

  // Add complete message
  const addMessage = useCallback((message: Omit<StreamingMessage, 'id' | 'timestamp'>) => {
    const fullMessage: StreamingMessage = {
      ...message,
      id: generateMessageId(),
      timestamp: new Date()
    }
    dispatch({ type: 'ADD_MESSAGE', payload: fullMessage })
  }, [generateMessageId])

  // Start streaming a new message
  const startStreaming = useCallback((type: 'human' | 'llm') => {
    const id = generateMessageId()
    dispatch({
      type: 'START_STREAMING',
      payload: { id, type, timestamp: new Date() }
    })
    return id
  }, [generateMessageId])

  // Append content to streaming message
  const appendContent = useCallback((id: string, content: string) => {
    dispatch({ type: 'APPEND_CONTENT', payload: { id, content } })
  }, [])

  // Complete streaming message
  const completeMessage = useCallback((id: string, finalContent?: string) => {
    dispatch({ type: 'COMPLETE_MESSAGE', payload: { id, finalContent } })
  }, [])

  // Set error
  const setError = useCallback((error: string, messageId?: string) => {
    dispatch({ type: 'SET_ERROR', payload: { error, id: messageId } })
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
  }, [])

  // Set session ID
  const setSessionId = useCallback((sessionId: string) => {
    dispatch({ type: 'SET_SESSION_ID', payload: sessionId })
  }, [])

  // Set connection status
  const setConnectionStatus = useCallback((connected: boolean) => {
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: connected })
  }, [])

  // Set connection state
  const setConnectionState = useCallback((connectionState: ConnectionState) => {
    dispatch({ type: 'SET_CONNECTION_STATE', payload: connectionState })
  }, [])

  // Set fallback mode
  const setFallbackMode = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_FALLBACK_MODE', payload: enabled })
  }, [])

  // Reset chat
  const resetChat = useCallback(() => {
    dispatch({ type: 'RESET_CHAT' })
  }, [])

  // Get current streaming message
  const getCurrentStreamingMessage = useCallback(() => {
    if (!state.currentStreamingId) return null
    return state.messages.find(msg => msg.id === state.currentStreamingId) || null
  }, [state.currentStreamingId, state.messages])

  // Get human-readable connection status
  const getConnectionStatus = useCallback(() => {
    return connectionRecovery.getRecoveryStatus()
  }, [connectionRecovery])

  // Sync connection recovery state with chat state
  useEffect(() => {
    setConnectionState(connectionRecovery.state)
    setFallbackMode(connectionRecovery.state === 'connected' && connectionRecovery.lastError !== null)
  }, [connectionRecovery.state, connectionRecovery.lastError, setConnectionState, setFallbackMode])

  return {
    // State
    messages: state.messages,
    isStreaming: !!state.currentStreamingId,
    isConnected: state.isConnected,
    error: state.error,
    sessionId: state.sessionId,
    connectionState: state.connectionState,
    fallbackMode: state.fallbackMode,

    // Actions
    addMessage,
    startStreaming,
    appendContent,
    completeMessage,
    setError,
    clearError,
    setSessionId,
    setConnectionStatus,
    setConnectionState,
    setFallbackMode,
    resetChat,

    // Recovery actions
    triggerRecovery: connectionRecovery.triggerRecovery,
    forceReconnect: connectionRecovery.forceReconnect,

    // Utilities
    getCurrentStreamingMessage,
    getConnectionStatus
  }
}