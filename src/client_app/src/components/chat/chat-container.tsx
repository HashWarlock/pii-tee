import { useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { StreamingMessage } from "./streaming-message"
import { cn } from "@/lib/utils"
import { Wifi, WifiOff, Shield } from "lucide-react"

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

interface ChatContainerProps {
  messages: StreamingMessage[]
  isConnected: boolean
  sessionId?: string | null
  className?: string
  autoScroll?: boolean
}

export function ChatContainer({
  messages,
  isConnected,
  sessionId,
  className,
  autoScroll = true
}: ChatContainerProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      })
    }
  }, [messages, autoScroll])

  const renderConnectionStatus = () => (
    <div className="flex items-center justify-between p-3 border-b bg-muted/30">
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <Wifi className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-600 font-medium">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive font-medium">Disconnected</span>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {sessionId && (
          <Badge variant="outline" className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            Session: {sessionId.slice(0, 8)}...
          </Badge>
        )}
        <Badge variant="secondary" className="text-xs">
          TEE Enabled
        </Badge>
      </div>
    </div>
  )

  const renderEmptyState = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Start Anonymous Conversation</h3>
          <p className="text-sm text-muted-foreground">
            Your messages will be automatically anonymized before being sent to the AI. 
            All PII data is protected using Trusted Execution Environment.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Badge variant="outline">PII Protected</Badge>
          <Badge variant="outline">TEE Secured</Badge>
          <Badge variant="outline">Real-time</Badge>
        </div>
      </div>
    </div>
  )

  const renderMessages = () => (
    <ScrollArea 
      ref={scrollAreaRef}
      className="flex-1 p-4"
    >
      <div className="space-y-4">
        {messages.map((message) => (
          <StreamingMessage
            key={message.id}
            message={message}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  )

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      {renderConnectionStatus()}
      
      <div className="flex-1 flex flex-col min-h-0">
        {messages.length === 0 ? renderEmptyState() : renderMessages()}
      </div>
    </Card>
  )
}