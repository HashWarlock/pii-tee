"use client"

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { ErrorBoundary } from "@/components/error-boundary"
import { ConnectionStatus } from "./connection-status"
import { StreamingFallback } from "./streaming-fallback"
import { ThemedMessage } from "./themed-message"
import { useStreamingChat } from "@/hooks/useStreamingChat"
import { useSSEClient } from "@/hooks/useSSEClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { 
  Send, 
  Loader2, 
  AlertTriangle, 
  Settings,
  Zap
} from "lucide-react"

interface EnhancedStreamingChatProps {
  apiEndpoint?: string
  className?: string
  onError?: (error: Error) => void
  showConnectionDetails?: boolean
}

export function EnhancedStreamingChat({
  apiEndpoint = '/api/chat/stream',
  className = "",
  onError,
  showConnectionDetails = false
}: EnhancedStreamingChatProps) {
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Streaming chat state management
  const chat = useStreamingChat()
  
  // SSE client for streaming
  const sseClient = useSSEClient({
    url: process.env.NEXT_PUBLIC_API_URL + '/stream' || 'http://pii-api:80/stream',
    onMessage: (data: Record<string, unknown>) => {
      try {
        if (data.type === 'content' && data.messageId && data.content) {
          chat.appendContent(String(data.messageId), String(data.content))
        } else if (data.type === 'complete' && data.messageId) {
          chat.completeMessage(String(data.messageId), data.finalContent ? String(data.finalContent) : undefined)
        } else if (data.type === 'error') {
          chat.setError(String(data.error) || 'Streaming error', data.messageId ? String(data.messageId) : undefined)
        }
      } catch (error) {
        console.error('Error processing SSE message:', error)
        chat.setError('Failed to process streaming response')
      }
    },
    onError: (error: string) => {
      console.error('SSE connection error:', error)
      chat.setError(error)
      chat.setConnectionState('error')
      chat.triggerRecovery()
    },
    onConnectionChange: (connected: boolean) => {
      chat.setConnectionStatus(connected)
      chat.setConnectionState(connected ? 'connected' : 'disconnected')
    }
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [chat.messages])

  // Handle streaming message submission
  const handleStreamingSubmit = useCallback(async (message: string) => {
    if (isSubmitting || !message.trim()) return

    setIsSubmitting(true)
    
    try {
      // Add human message immediately
      const humanMessageId = chat.startStreaming('human')
      chat.completeMessage(humanMessageId, message)
      
      // Start LLM response streaming
      const llmMessageId = chat.startStreaming('llm')
      
      // Connect SSE client for streaming response
      sseClient.connect()
      
      chat.setConnectionState('connected')
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      chat.setError(errorMessage)
      onError?.(error instanceof Error ? error : new Error(errorMessage))
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, chat, sseClient, apiEndpoint, onError])

  // Handle fallback mode submission (non-streaming)
  const handleFallbackSubmit = useCallback(async (message: string) => {
    if (isSubmitting || !message.trim()) return

    setIsSubmitting(true)
    
    try {
      // Add human message
      chat.addMessage({
        type: 'human',
        content: message,
        isStreaming: false,
        isComplete: true
      })

      // Send non-streaming request
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId: chat.sessionId })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Add LLM response
      chat.addMessage({
        type: 'llm',
        content: data.response || 'No response received',
        isStreaming: false,
        isComplete: true,
        sessionId: data.sessionId
      })

      // Update session if provided
      if (data.sessionId) {
        chat.setSessionId(data.sessionId)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      chat.setError(errorMessage)
      onError?.(error instanceof Error ? error : new Error(errorMessage))
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, chat, onError])

  // Handle regular input submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSubmitting) return

    const message = input.trim()
    setInput('')

    if (chat.fallbackMode) {
      handleFallbackSubmit(message)
    } else {
      handleStreamingSubmit(message)
    }
  }, [input, isSubmitting, chat.fallbackMode, handleFallbackSubmit, handleStreamingSubmit])

  // Retry streaming connection
  const handleRetryStreaming = useCallback(() => {
    chat.setFallbackMode(false)
    chat.forceReconnect()
    chat.clearError()
  }, [chat])

  // Enable fallback mode
  const handleEnableFallback = useCallback(() => {
    chat.setFallbackMode(true)
    chat.clearError()
  }, [chat])

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Chat component error:', error, errorInfo)
        onError?.(error)
      }}
      maxRetries={2}
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      <div className={`flex flex-col h-full ${className}`}>
        {/* Connection status header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h2 className="font-semibold">PII-TEE Chat</h2>
              {chat.sessionId && (
                <Badge variant="outline" className="text-xs">
                  Session: {chat.sessionId.slice(-8)}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <ConnectionStatus
                connectionState={chat.connectionState}
                fallbackMode={chat.fallbackMode}
                error={chat.error}
                retryCount={0} // Would need to get from recovery hook
                onRetry={chat.triggerRecovery}
                onForceReconnect={chat.forceReconnect}
                onEnableFallback={handleEnableFallback}
                showDetails={showConnectionDetails}
              />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {/* Toggle details */}}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
          <div className="space-y-4">
            {chat.messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="space-y-2">
                  <Zap className="h-8 w-8 mx-auto opacity-50" />
                  <p>Start a secure conversation with PII protection</p>
                  <p className="text-xs">Your personal information will be automatically anonymized</p>
                </div>
              </div>
            ) : (
              chat.messages.map((message) => (
                <div key={message.id}>
                  <ThemedMessage
                    message={{
                      id: message.id,
                      content: message.content,
                      type: message.type,
                      timestamp: message.timestamp,
                      isStreaming: message.isStreaming,
                      isComplete: !message.isStreaming
                    }}
                    showTimestamp
                  />
                  
                  {message.error && (
                    <div className="mt-2 p-2 bg-destructive/5 border border-destructive/20 rounded text-sm text-destructive flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{message.error}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => chat.clearError()}
                        className="ml-auto h-6 text-xs"
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Input area */}
        <div className="p-4">
          {chat.fallbackMode ? (
            <StreamingFallback
              onSendMessage={handleFallbackSubmit}
              isLoading={isSubmitting}
              error={chat.error}
              onRetryStreaming={handleRetryStreaming}
            />
          ) : (
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={isSubmitting || chat.connectionState === 'error'}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isSubmitting || chat.connectionState === 'error'}
                size="icon"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          )}

          {/* Error display */}
          {chat.error && !chat.fallbackMode && (
            <div className="mt-2 p-2 bg-destructive/5 border border-destructive/20 rounded text-sm text-destructive flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <span>{chat.error}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEnableFallback}
                  className="h-6 text-xs"
                >
                  Use Fallback
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => chat.clearError()}
                  className="h-6 text-xs"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}