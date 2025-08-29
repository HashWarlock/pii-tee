"use client"

import React, { useState, useCallback } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  Send, 
  Loader2, 
  AlertTriangle, 
  Wifi, 
  Shield,
  Clock
} from "lucide-react"

interface StreamingFallbackProps {
  onSendMessage: (message: string) => Promise<void>
  isLoading?: boolean
  error?: string | null
  onRetryStreaming?: () => void
  className?: string
}

export function StreamingFallback({
  onSendMessage,
  isLoading = false,
  error = null,
  onRetryStreaming,
  className = ""
}: StreamingFallbackProps) {
  const [message, setMessage] = useState('')
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!message.trim() || isLoading) return
    
    const messageToSend = message.trim()
    setMessage('')
    setLastSentAt(new Date())
    
    try {
      await onSendMessage(messageToSend)
    } catch (error) {
      // Error handling is managed by parent component
      console.error('Fallback message send failed:', error)
    }
  }, [message, isLoading, onSendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as React.FormEvent)
    }
  }, [handleSubmit])

  return (
    <Card className={`p-4 border-dashed ${className}`}>
      <div className="space-y-4">
        {/* Fallback mode indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-orange-500/10 rounded-full">
              <Shield className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Fallback Mode Active</h3>
              <p className="text-xs text-muted-foreground">
                Real-time streaming unavailable, using standard messaging
              </p>
            </div>
          </div>
          
          {onRetryStreaming && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetryStreaming}
              className="text-xs"
            >
              <Wifi className="h-3 w-3 mr-1" />
              Try Streaming
            </Button>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="flex items-center space-x-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Message input form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
              rows={3}
              className="resize-none pr-12"
              disabled={isLoading}
            />
            
            <Button
              type="submit"
              size="sm"
              disabled={!message.trim() || isLoading}
              className="absolute bottom-2 right-2 h-8 w-8 p-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs">
                Non-streaming mode
              </Badge>
              {lastSentAt && (
                <span className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Last sent: {lastSentAt.toLocaleTimeString()}
                </span>
              )}
            </div>
            
            <span>{message.length} characters</span>
          </div>
        </form>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-lg">
          <p><strong>Fallback Mode:</strong></p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>Messages are sent in full batches instead of streaming</li>
            <li>Responses may take longer to appear</li>
            <li>All PII protection features remain active</li>
            <li>Try the &quot;Try Streaming&quot; button to restore real-time mode</li>
          </ul>
        </div>
      </div>
    </Card>
  )
}

// Simplified version for inline use
export function StreamingFallbackInline({
  onSendMessage,
  isLoading = false,
  className = ""
}: Pick<StreamingFallbackProps, 'onSendMessage' | 'isLoading' | 'className'>) {
  const [message, setMessage] = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isLoading) return
    
    const messageToSend = message.trim()
    setMessage('')
    
    try {
      await onSendMessage(messageToSend)
    } catch (error) {
      console.error('Inline fallback message send failed:', error)
    }
  }, [message, isLoading, onSendMessage])

  return (
    <form onSubmit={handleSubmit} className={`flex items-center space-x-2 ${className}`}>
      <div className="flex-1 relative">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type message (fallback mode)..."
          rows={1}
          className="resize-none pr-10"
          disabled={isLoading}
        />
        <Badge 
          variant="secondary" 
          className="absolute top-1 right-1 text-xs pointer-events-none"
        >
          <Shield className="h-2 w-2 mr-1" />
          Fallback
        </Badge>
      </div>
      
      <Button
        type="submit"
        size="sm"
        disabled={!message.trim() || isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </form>
  )
}