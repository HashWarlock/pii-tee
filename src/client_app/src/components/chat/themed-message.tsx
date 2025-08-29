import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TypingIndicator } from "./typing-indicator"
import { useTypewriter } from "@/hooks/useTypewriter"
import { getMessageTheme } from "@/lib/message-themes"
import { Eye, EyeOff, AlertCircle, Clock, Shield, CheckCircle2 } from "lucide-react"

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

interface ThemedMessageProps {
  message: StreamingMessage
  theme?: string
  className?: string
  enableTypewriter?: boolean
  typewriterSpeed?: number
  showTimestamp?: boolean
  showOriginalToggle?: boolean
  showStatusIndicators?: boolean
}

export function ThemedMessage({ 
  message, 
  theme = 'default',
  className,
  enableTypewriter = true,
  typewriterSpeed = 25,
  showTimestamp = true,
  showOriginalToggle = true,
  showStatusIndicators = true
}: ThemedMessageProps) {
  const [showOriginal, setShowOriginal] = useState(false)
  const isHuman = message.type === 'human'
  const messageTheme = getMessageTheme(theme)
  const currentTheme = isHuman ? messageTheme.human : messageTheme.llm

  // Typewriter effect for streaming content
  const {
    displayText: typewrittenText
  } = useTypewriter(
    message.content,
    {
      speed: typewriterSpeed,
      showCursor: false,
      startDelay: 50
    }
  )

  // Determine display content
  const displayContent = useMemo(() => {
    if (!enableTypewriter || message.isComplete || isHuman) {
      return message.content
    }
    return message.isStreaming ? typewrittenText : message.content
  }, [enableTypewriter, message.isComplete, message.isStreaming, message.content, typewrittenText, isHuman])

  // Format timestamp
  const formattedTime = useMemo(() => {
    const now = new Date()
    const messageTime = message.timestamp
    const diffMinutes = Math.floor((now.getTime() - messageTime.getTime()) / 60000)
    
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [message.timestamp])

  const renderAvatar = () => {
    const IconComponent = currentTheme.avatar.icon
    return (
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center shadow-lg ring-2 ring-background/50 transition-transform hover:scale-105",
        currentTheme.avatar.background
      )}>
        <IconComponent className={cn("h-5 w-5", currentTheme.avatar.iconColor)} />
      </div>
    )
  }

  const renderMessageHeader = () => (
    <div className={cn(
      "flex items-center gap-3 mb-3",
      currentTheme.alignment === 'right' ? 'flex-row-reverse' : 'flex-row'
    )}>
      {renderAvatar()}
      
      <div className={cn(
        "flex items-center gap-2 flex-wrap",
        currentTheme.alignment === 'right' ? 'flex-row-reverse' : 'flex-row'
      )}>
        {showTimestamp && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-full">
            <Clock className="h-3 w-3" />
            <span>{formattedTime}</span>
          </div>
        )}
        
        {showStatusIndicators && (
          <>
            {message.isAnonymized && (
              <Badge variant="secondary" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Protected
              </Badge>
            )}
            
            {message.isStreaming && (
              <Badge variant="outline" className="text-xs animate-pulse border-green-200 text-green-700 bg-green-50">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-ping mr-1" />
                Streaming
              </Badge>
            )}

            {message.isComplete && !message.error && (
              <Badge variant="secondary" className="text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Delivered
              </Badge>
            )}
          </>
        )}
      </div>
    </div>
  )

  const renderMessageContent = () => {
    const hasGradient = currentTheme.gradient
    const backgroundClass = hasGradient ? currentTheme.gradient : currentTheme.background

    return (
      <Card className={cn(
        "p-4 max-w-full transition-all duration-300 relative overflow-hidden shadow-sm hover:shadow-md",
        backgroundClass,
        currentTheme.text,
        currentTheme.border,
        message.error && "border-destructive bg-destructive/10",
        message.isStreaming && !message.isComplete && "animate-pulse",
        // Enhanced visual styling
        isHuman ? "rounded-tl-2xl rounded-tr-sm rounded-bl-2xl rounded-br-2xl" 
                : "rounded-tl-sm rounded-tr-2xl rounded-bl-2xl rounded-br-2xl"
      )}>
        <div className="space-y-3">
          {/* Message content */}
          <div className="relative">
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {displayContent}
              {message.isStreaming && !message.isComplete && (
                <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1 opacity-75" />
              )}
            </p>
            
            {/* Streaming glow effect */}
            {message.isStreaming && !message.isComplete && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            )}
          </div>
          
          {/* Empty message indicator */}
          {!isHuman && message.isStreaming && displayContent.length === 0 && (
            <TypingIndicator 
              isVisible={true} 
              variant="wave" 
              size="sm"
              text={`AI is ${message.type === 'llm' ? 'thinking' : 'processing'}...`}
              className="justify-center"
            />
          )}
          
          {/* Error display */}
          {message.error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/20 rounded-lg border border-destructive/30">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="text-sm text-destructive font-medium">{message.error}</span>
            </div>
          )}
        </div>
      </Card>
    )
  }

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
          className={cn(
            "text-xs h-auto p-2 hover:bg-muted/50 rounded-full transition-all",
            currentTheme.alignment === 'right' ? 'ml-auto' : 'mr-auto'
          )}
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
          <Card className="p-3 bg-muted/20 border-dashed border-muted-foreground/30 backdrop-blur-sm">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Original (before anonymization):
            </div>
            <p className="text-sm whitespace-pre-wrap break-words text-foreground/80">
              {message.originalContent}
            </p>
          </Card>
        )}
      </div>
    )
  }

  const renderAccessibilityInfo = () => {
    if (!showStatusIndicators) return null
    
    return (
      <div className="sr-only">
        {isHuman ? 'Your message' : 'AI response'} sent at {formattedTime}.
        {message.isAnonymized && ' This message was anonymized for privacy.'}
        {message.isStreaming && ' Currently being delivered.'}
        {message.error && ` Error: ${message.error}`}
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "flex w-full mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500",
        currentTheme.alignment === 'right' ? "justify-end" : "justify-start",
        className
      )}
      role="listitem"
      aria-label={`${isHuman ? 'User' : 'AI'} message`}
    >
      <div className={cn(
        "max-w-[85%] space-y-2 w-full",
        currentTheme.alignment === 'right' ? "items-end" : "items-start"
      )}>
        {renderMessageHeader()}
        {renderMessageContent()}
        {renderOriginalContent()}
        {renderAccessibilityInfo()}
      </div>
    </div>
  )
}