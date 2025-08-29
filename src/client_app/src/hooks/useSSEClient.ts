import { useCallback, useEffect, useRef, useState } from 'react'

export interface SSEMessage {
  id?: string
  event?: string
  data: string
  retry?: number
}

export interface SSEClientConfig {
  url: string
  withCredentials?: boolean
  headers?: Record<string, string>
  heartbeatInterval?: number
  maxReconnectAttempts?: number
  reconnectDelay?: number
  onMessage?: (data: Record<string, unknown>) => void
  onError?: (error: string) => void
  onConnectionChange?: (connected: boolean) => void
}

export interface SSEClientState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  reconnectAttempts: number
  lastEventId: string | null
}

export interface UseSSEClientReturn {
  state: SSEClientState
  connect: () => void
  disconnect: () => void
  sendMessage: (data: Record<string, unknown>) => void
  onMessage: (callback: (message: SSEMessage) => void) => () => void
  onError: (callback: (error: Event | string) => void) => () => void
  onOpen: (callback: () => void) => () => void
  onClose: (callback: () => void) => () => void
}

export function useSSEClient(config: SSEClientConfig): UseSSEClientReturn {
  const [state, setState] = useState<SSEClientState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempts: 0,
    lastEventId: null
  })

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const messageCallbacksRef = useRef<Set<(message: SSEMessage) => void>>(new Set())
  const errorCallbacksRef = useRef<Set<(error: Event | string) => void>>(new Set())
  const openCallbacksRef = useRef<Set<() => void>>(new Set())
  const closeCallbacksRef = useRef<Set<() => void>>(new Set())

  const {
    url,
    withCredentials = false,
    headers = {},
    heartbeatInterval = 30000,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000
  } = config

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // Parse SSE message
  const parseSSEMessage = useCallback((rawData: string): SSEMessage => {
    const lines = rawData.split('\n')
    const message: SSEMessage = { data: '' }

    for (const line of lines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex === -1) continue

      const field = line.slice(0, colonIndex).trim()
      const value = line.slice(colonIndex + 1).trim()

      switch (field) {
        case 'id':
          message.id = value
          break
        case 'event':
          message.event = value
          break
        case 'data':
          message.data += (message.data ? '\n' : '') + value
          break
        case 'retry':
          message.retry = parseInt(value, 10)
          break
      }
    }

    return message
  }, [])

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval > 0) {
      heartbeatIntervalRef.current = setInterval(() => {
        if (eventSourceRef.current?.readyState === EventSource.OPEN) {
          // Send ping if server supports it
          console.debug('[SSE] Heartbeat check')
        }
      }, heartbeatInterval)
    }
  }, [heartbeatInterval])

  // Handle reconnection
  const scheduleReconnect = useCallback(() => {
    if (state.reconnectAttempts >= maxReconnectAttempts) {
      setState(prev => ({
        ...prev,
        error: `Max reconnection attempts (${maxReconnectAttempts}) exceeded`,
        isConnecting: false
      }))
      return
    }

    const delay = Math.min(reconnectDelay * Math.pow(2, state.reconnectAttempts), 30000)
    
    setState(prev => ({
      ...prev,
      isConnecting: true,
      error: `Reconnecting in ${delay}ms... (attempt ${prev.reconnectAttempts + 1})`
    }))

    reconnectTimeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }))
      connect()
    }, delay)
  }, [state.reconnectAttempts, maxReconnectAttempts, reconnectDelay])

  // Connect to SSE
  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return
    }

    // Close existing connection
    disconnect()

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      // Create EventSource with headers support
      let sseUrl = url
      if (state.lastEventId) {
        const separator = url.includes('?') ? '&' : '?'
        sseUrl += `${separator}lastEventId=${encodeURIComponent(state.lastEventId)}`
      }

      const eventSource = new EventSource(sseUrl, { withCredentials })
      eventSourceRef.current = eventSource

      // Handle connection open
      eventSource.onopen = () => {
        console.log('[SSE] Connected')
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
          reconnectAttempts: 0
        }))
        startHeartbeat()
        openCallbacksRef.current.forEach(callback => callback())
      }

      // Handle messages
      eventSource.onmessage = (event) => {
        const message: SSEMessage = {
          id: event.lastEventId || undefined,
          data: event.data
        }

        setState(prev => ({ ...prev, lastEventId: event.lastEventId || prev.lastEventId }))
        messageCallbacksRef.current.forEach(callback => callback(message))
      }

      // Handle errors
      eventSource.onerror = (error) => {
        console.error('[SSE] Error:', error)
        
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          error: 'Connection error'
        }))

        clearTimers()
        errorCallbacksRef.current.forEach(callback => callback(error))

        // Auto-reconnect on error
        if (eventSource.readyState === EventSource.CLOSED) {
          closeCallbacksRef.current.forEach(callback => callback())
          scheduleReconnect()
        }
      }

      // Handle custom events
      eventSource.addEventListener('error', (event) => {
        const customEvent = event as MessageEvent
        try {
          const message = parseSSEMessage(customEvent.data)
          messageCallbacksRef.current.forEach(callback => callback(message))
        } catch (err) {
          console.error('[SSE] Failed to parse custom message:', err)
        }
      })

    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error)
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }))
    }
  }, [url, state.lastEventId, withCredentials, parseSSEMessage, startHeartbeat, scheduleReconnect])

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    clearTimers()

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0
    }))
  }, [clearTimers])

  // Send message (for bidirectional communication via separate HTTP endpoint)
  const sendMessage = useCallback(async (data: Record<string, unknown>) => {
    try {
      const response = await fetch(url.replace('/stream', '/message'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        credentials: withCredentials ? 'include' : 'same-origin',
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      console.error('[SSE] Failed to send message:', error)
      errorCallbacksRef.current.forEach(callback => 
        callback(error instanceof Error ? error.message : 'Send failed')
      )
    }
  }, [url, headers, withCredentials])

  // Event listeners
  const onMessage = useCallback((callback: (message: SSEMessage) => void) => {
    messageCallbacksRef.current.add(callback)
    return () => messageCallbacksRef.current.delete(callback)
  }, [])

  const onError = useCallback((callback: (error: Event | string) => void) => {
    errorCallbacksRef.current.add(callback)
    return () => errorCallbacksRef.current.delete(callback)
  }, [])

  const onOpen = useCallback((callback: () => void) => {
    openCallbacksRef.current.add(callback)
    return () => openCallbacksRef.current.delete(callback)
  }, [])

  const onClose = useCallback((callback: () => void) => {
    closeCallbacksRef.current.add(callback)
    return () => closeCallbacksRef.current.delete(callback)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    state,
    connect,
    disconnect,
    sendMessage,
    onMessage,
    onError,
    onOpen,
    onClose
  }
}