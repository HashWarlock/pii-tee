import { useCallback, useEffect, useRef } from 'react'
import { useSSEClient, SSEMessage } from './useSSEClient'
import { useStreamingChat } from './useStreamingChat'
import { apiClient } from '@/lib/api-client'

export interface StreamingChatConfig {
  apiBaseUrl?: string
  openaiApiKey?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface UseLLMStreamingReturn {
  // Chat state
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }>
  isStreaming: boolean
  isConnected: boolean
  error: string | null
  sessionId: string | null

  // Actions
  sendMessage: (message: string) => Promise<void>
  clearChat: () => void
  reconnect: () => void

  // Status
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error'
}

export function useLLMStreaming(config: StreamingChatConfig = {}): UseLLMStreamingReturn {
  const {
    apiBaseUrl = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    openaiApiKey = process.env.OPENAI_API_KEY,
    model = 'gpt-5-mini-2025-08-07',
    temperature = 0.7,
    maxTokens = 500
  } = config

  const currentMessageIdRef = useRef<string | null>(null)
  const isProcessingRef = useRef(false)

  // Initialize chat state management
  const {
    messages,
    isStreaming,
    sessionId,
    error: chatError,
    addMessage,
    startStreaming,
    appendContent,
    completeMessage,
    setError,
    clearError,
    setSessionId,
    setConnectionStatus,
    resetChat
  } = useStreamingChat()

  // Initialize SSE client
  const sseClient = useSSEClient({
    url: `${apiBaseUrl}/stream`,
    withCredentials: false,
    headers: {
      'Authorization': openaiApiKey ? `Bearer ${openaiApiKey}` : '',
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache'
    },
    heartbeatInterval: 30000,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000
  })

  // Handle SSE messages
  const handleSSEMessage = useCallback((message: SSEMessage) => {
    try {
      const data = JSON.parse(message.data)
      
      switch (data.type) {
        case 'session_created':
          setSessionId(data.session_id)
          console.log('[LLM] Session created:', data.session_id)
          break

        case 'message_start':
          if (!currentMessageIdRef.current) {
            currentMessageIdRef.current = startStreaming('llm')
          }
          break

        case 'content_delta':
          if (currentMessageIdRef.current && data.delta) {
            appendContent(currentMessageIdRef.current, data.delta)
          }
          break

        case 'message_complete':
          if (currentMessageIdRef.current) {
            completeMessage(currentMessageIdRef.current, data.content)
            currentMessageIdRef.current = null
          }
          isProcessingRef.current = false
          break

        case 'error':
          const errorMessage = data.error || 'Unknown streaming error'
          if (currentMessageIdRef.current) {
            setError(errorMessage, currentMessageIdRef.current)
            currentMessageIdRef.current = null
          } else {
            setError(errorMessage)
          }
          isProcessingRef.current = false
          break

        case 'ping':
          // Heartbeat response - ignore
          break

        default:
          console.warn('[LLM] Unknown message type:', data.type)
      }
    } catch (error) {
      console.error('[LLM] Failed to parse SSE message:', error)
      setError('Failed to parse streaming response')
      isProcessingRef.current = false
    }
  }, [startStreaming, appendContent, completeMessage, setError, setSessionId])

  // Handle SSE connection events
  useEffect(() => {
    const unsubscribeMessage = sseClient.onMessage(handleSSEMessage)
    
    const unsubscribeOpen = sseClient.onOpen(() => {
      console.log('[LLM] SSE connection opened')
      setConnectionStatus(true)
      clearError()
    })

    const unsubscribeClose = sseClient.onClose(() => {
      console.log('[LLM] SSE connection closed')
      setConnectionStatus(false)
    })

    const unsubscribeError = sseClient.onError((error) => {
      console.error('[LLM] SSE connection error:', error)
      setConnectionStatus(false)
      setError(typeof error === 'string' ? error : 'Connection error')
      isProcessingRef.current = false
      currentMessageIdRef.current = null
    })

    return () => {
      unsubscribeMessage()
      unsubscribeOpen()
      unsubscribeClose()
      unsubscribeError()
    }
  }, [sseClient, handleSSEMessage, setConnectionStatus, setError, clearError])

  // Send message function
  const sendMessage = useCallback(async (message: string) => {
    if (isProcessingRef.current || !message.trim()) {
      return
    }

    isProcessingRef.current = true
    clearError()

    try {
      // Add user message immediately
      addMessage({
        type: 'human',
        content: message,
        isStreaming: false,
        isComplete: true,
        sessionId: sessionId || undefined
      })

      // Connect SSE if not connected
      if (!sseClient.state.isConnected) {
        sseClient.connect()
        // Wait a moment for connection
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Anonymize the message first
      const anonymizeResponse = await apiClient.anonymize({
        text: message,
        session_id: sessionId || undefined,
        language: 'en'
      })

      // Update session ID if received
      if (anonymizeResponse.data?.session_id) {
        setSessionId(anonymizeResponse.data.session_id)
      }

      // Send anonymized text for LLM processing via SSE
      await sseClient.sendMessage({
        type: 'chat_message',
        message: anonymizeResponse.data?.text || message,
        session_id: anonymizeResponse.data?.session_id,
        options: {
          model,
          temperature,
          max_tokens: maxTokens,
          stream: true
        }
      })

      // Update the user message with anonymization info
      if (anonymizeResponse.data?.text && anonymizeResponse.data.text !== message) {
        // Find and update the last human message
        const lastMessage = messages[messages.length - 1]
        if (lastMessage && lastMessage.type === 'human') {
          // This would require updating the messages state - simplified for now
          console.log('[LLM] Message anonymized:', { original: message, anonymized: anonymizeResponse.data?.text })
        }
      }

    } catch (error) {
      console.error('[LLM] Failed to send message:', error)
      setError(error instanceof Error ? error.message : 'Failed to send message')
      isProcessingRef.current = false
    }
  }, [
    sessionId, 
    sseClient, 
    addMessage, 
    setSessionId, 
    setError, 
    clearError,
    model,
    temperature, 
    maxTokens,
    messages
  ])

  // Clear chat function
  const clearChat = useCallback(() => {
    resetChat()
    currentMessageIdRef.current = null
    isProcessingRef.current = false
  }, [resetChat])

  // Reconnect function
  const reconnect = useCallback(() => {
    sseClient.disconnect()
    setTimeout(() => {
      sseClient.connect()
    }, 1000)
  }, [sseClient])

  // Auto-connect on mount
  useEffect(() => {
    sseClient.connect()
    return () => {
      sseClient.disconnect()
    }
  }, [sseClient])

  // Determine connection status
  const getConnectionStatus = useCallback(() => {
    if (sseClient.state.isConnected) return 'connected'
    if (sseClient.state.isConnecting) return 'connecting'
    if (sseClient.state.error) return 'error'
    return 'disconnected'
  }, [sseClient.state])

  return {
    // Chat state
    messages: messages.map(msg => ({
      id: msg.id,
      role: msg.type === 'human' ? 'user' as const : 'assistant' as const,
      content: msg.content,
      timestamp: msg.timestamp
    })),
    isStreaming: isStreaming || isProcessingRef.current,
    isConnected: sseClient.state.isConnected,
    error: chatError || sseClient.state.error,
    sessionId,

    // Actions
    sendMessage,
    clearChat,
    reconnect,

    // Status
    connectionStatus: getConnectionStatus()
  }
}