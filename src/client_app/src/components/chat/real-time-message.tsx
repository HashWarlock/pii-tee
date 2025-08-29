import { useEffect, useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TypingIndicator } from "./typing-indicator"
import { useTypewriter } from "@/hooks/useTypewriter"
import { Eye, EyeOff, AlertCircle, Bot, User, Clock, Shield } from "lucide-react"

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

interface RealTimeMessageProps {
  message: StreamingMessage
  className?: string
  enableTypewriter?: boolean
  typewriterSpeed?: number
  showTimestamp?: boolean
  showOriginalToggle?: boolean
}

export function RealTimeMessage({ 
  message, 
  className,
  enableTypewriter = true,
  typewriterSpeed = 20,
  showTimestamp = true,
  showOriginalToggle = true
}: RealTimeMessageProps) {
  const [showOriginal, setShowOriginal] = useState(false)
  const [hasError, setHasError] = useState(false)
  const isHuman = message.type === 'human'

  // Typewriter effect for streaming content
  const {
    displayText: typewrittenText
  } = useTypewriter(
    message.content,
    {
      speed: typewriterSpeed,
      showCursor: false,
      startDelay: 0
    }
  )

  // Determine what content to show
  const displayContent = useMemo(() => {
    if (!enableTypewriter || message.isComplete || isHuman) {
      return message.content
    }
    return message.isStreaming ? typewrittenText : message.content
  }, [enableTypewriter, message.isComplete, message.isStreaming, message.content, typewrittenText, isHuman])

  // Handle error state
  useEffect(() => {
    setHasError(!!message.error)
  }, [message.error])

  // Format timestamp
  const formattedTime = useMemo(() => {
    const now = new Date()
    const messageTime = message.timestamp
    const diffMinutes = Math.floor((now.getTime() - messageTime.getTime()) / 60000)
    
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [message.timestamp])

  const renderMessageHeader = () => (
    <div className="flex items-center gap-2 mb-2">
      {!isHuman && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
          <Bot className="h-4 w-4" />
        </div>
      )}
      
      <div className="flex items-center gap-2 flex-wrap">
        {showTimestamp && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formattedTime}</span>
          </div>
        )}
        
        {message.isAnonymized && (
          <Badge variant="secondary" className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            PII Protected
          </Badge>
        )}
        
        {message.isStreaming && (
          <Badge variant="outline" className="text-xs animate-pulse border-green-200 text-green-700">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping mr-1" />
            Live
          </Badge>
        )}

        {message.sessionId && (
          <Badge variant="secondary" className="text-xs">
            Session: {message.sessionId.slice(0, 6)}...
          </Badge>
        )}
      </div>
      
      {isHuman && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-teal-600 flex items-center justify-center text-white shadow-lg ml-auto">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  )

  const renderMessageContent = () => (
    <Card className={cn(
      "p-4 max-w-full transition-all duration-200 relative overflow-hidden",
      isHuman 
        ? "bg-primary text-primary-foreground shadow-md" 
        : "bg-muted shadow-sm",
      hasError && "border-destructive bg-destructive/5",
      message.isStreaming && "border-l-4 border-l-blue-500"
    )}>
      <div className="space-y-3">
        <div className="relative">
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {displayContent}
            {message.isStreaming && !message.isComplete && (
              <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1 opacity-75" />
            )}
          </p>
          
          {/* Streaming indicator */}
          {message.isStreaming && !message.isComplete && !isHuman && (
            <div className="absolute -bottom-1 -right-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            </div>
          )}
        </div>
        
        {/* Typing indicator for non-human messages */}
        {!isHuman && message.isStreaming && displayContent.length === 0 && (
          <TypingIndicator 
            isVisible={true} 
            variant="wave" 
            size="sm"
            text="AI is thinking..."
          />
        )}
        
        {/* Error display */}
        {message.error && (
          <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-md border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <span className="text-sm text-destructive">{message.error}</span>
          </div>
        )}
        
        {/* Completion indicator */}
        {message.isComplete && !isHuman && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>Response complete</span>
          </div>
        )}
      </div>
    </Card>
  )

  const renderOriginalContent = () => {
    if (!message.originalContent || 
        message.originalContent === message.content || 
        !showOriginalToggle) {
      return null
    }

    return (
      <div className="mt-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowOriginal(!showOriginal)}
          className="text-xs h-auto p-2 hover:bg-muted/50"
        >
          {showOriginal ? (
            <>
              <EyeOff className="h-3 w-3 mr-1" />
              Hide original content
            </>
          ) : (
            <>
              <Eye className="h-3 w-3 mr-1" />
              Show original content
            </>
          )}
        </Button>
        
        {showOriginal && (
          <Card className="p-3 bg-muted/30 border-dashed border-muted-foreground/30">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Original content (before PII anonymization):
            </div>
            <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">
              {message.originalContent}
            </p>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className={cn(
      "flex w-full mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
      isHuman ? "justify-end" : "justify-start",
      className
    )}>
      <div className={cn(
        "max-w-[85%] space-y-2",
        isHuman ? "items-end" : "items-start"
      )}>
        {renderMessageHeader()}
        {renderMessageContent()}
        {renderOriginalContent()}
      </div>
    </div>
  )
}