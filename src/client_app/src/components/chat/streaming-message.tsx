import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, AlertCircle, Bot, User } from "lucide-react"

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

interface StreamingMessageProps {
  message: StreamingMessage
  className?: string
  showTypingIndicator?: boolean
  typingSpeed?: number
}

export function StreamingMessage({ 
  message, 
  className,
  showTypingIndicator = true,
  typingSpeed = 30 // ms per character
}: StreamingMessageProps) {
  const [displayedContent, setDisplayedContent] = useState('')
  const [showOriginal, setShowOriginal] = useState(false)
  const isHuman = message.type === 'human'

  // Simulate typing effect for streaming content
  useEffect(() => {
    if (message.isStreaming && message.content.length > displayedContent.length) {
      const timer = setTimeout(() => {
        setDisplayedContent(message.content.slice(0, displayedContent.length + 1))
      }, typingSpeed)
      return () => clearTimeout(timer)
    } else if (message.isComplete) {
      setDisplayedContent(message.content)
    }
  }, [message.content, message.isStreaming, message.isComplete, displayedContent.length, typingSpeed])

  // Reset displayed content when message changes
  useEffect(() => {
    if (message.isStreaming) {
      setDisplayedContent('')
    }
  }, [message.id, message.isStreaming])

  const renderTypingIndicator = () => {
    if (!showTypingIndicator || !message.isStreaming || message.content.length === 0) return null
    
    return (
      <div className="flex items-center gap-1 mt-2">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
        </div>
        <span className="text-xs text-muted-foreground ml-2">
          {message.type === 'llm' ? 'AI is typing...' : 'Processing...'}
        </span>
      </div>
    )
  }

  const renderError = () => {
    if (!message.error) return null
    
    return (
      <div className="flex items-center gap-2 mt-2 p-2 bg-destructive/10 rounded-md">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">{message.error}</span>
      </div>
    )
  }

  const renderOriginalContent = () => {
    if (!message.originalContent || message.originalContent === message.content) return null

    return (
      <div className="mt-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowOriginal(!showOriginal)}
          className="text-xs h-auto p-1"
        >
          {showOriginal ? (
            <>
              <EyeOff className="h-3 w-3 mr-1" />
              Hide original
            </>
          ) : (
            <>
              <Eye className="h-3 w-3 mr-1" />
              Show original
            </>
          )}
        </Button>
        
        {showOriginal && (
          <Card className="p-3 bg-muted/50 border-dashed text-sm">
            <div className="text-xs text-muted-foreground mb-2">Original (before anonymization):</div>
            <p className="whitespace-pre-wrap break-words">{message.originalContent}</p>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className={cn(
      "flex w-full mb-4",
      isHuman ? "justify-end" : "justify-start",
      className
    )}>
      <div className={cn(
        "max-w-[80%] space-y-2",
        isHuman ? "items-end" : "items-start"
      )}>
        {/* Message Header */}
        <div className="flex items-center gap-2">
          {!isHuman && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white">
              <Bot className="h-4 w-4" />
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {message.timestamp.toLocaleTimeString()}
            </span>
            
            {message.isAnonymized && (
              <Badge variant="secondary" className="text-xs">
                <Eye className="h-3 w-3 mr-1" />
                Anonymized
              </Badge>
            )}
            
            {message.isStreaming && (
              <Badge variant="outline" className="text-xs animate-pulse">
                Streaming...
              </Badge>
            )}
          </div>
          
          {isHuman && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-teal-600 flex items-center justify-center text-white">
              <User className="h-4 w-4" />
            </div>
          )}
        </div>
        
        {/* Message Content */}
        <Card className={cn(
          "p-3 max-w-full transition-all duration-200",
          isHuman 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted",
          message.error && "border-destructive"
        )}>
          <div className="space-y-2">
            <p className="text-sm whitespace-pre-wrap break-words">
              {displayedContent}
              {message.isStreaming && displayedContent.length < message.content.length && (
                <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
              )}
            </p>
            
            {renderTypingIndicator()}
            {renderError()}
          </div>
        </Card>
        
        {renderOriginalContent()}
      </div>
    </div>
  )
}