import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChatMessage } from "@/types/api"

interface MessageBubbleProps {
  message: ChatMessage
  className?: string
}

export function MessageBubble({ message, className }: MessageBubbleProps) {
  const isHuman = message.type === 'human'
  
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
        <div className="flex items-center gap-2">
          {!isHuman && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
              AI
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString()}
          </span>
          {message.isAnonymized && (
            <Badge variant="secondary" className="text-xs">
              Anonymized
            </Badge>
          )}
          {isHuman && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold">
              You
            </div>
          )}
        </div>
        
        <Card className={cn(
          "p-3 max-w-full",
          isHuman 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted"
        )}>
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </Card>
        
        {message.originalContent && message.originalContent !== message.content && (
          <details className="text-xs text-muted-foreground cursor-pointer">
            <summary className="hover:text-foreground transition-colors">
              View original (before anonymization)
            </summary>
            <Card className="mt-2 p-2 bg-background/50 border-dashed">
              <p className="whitespace-pre-wrap break-words">
                {message.originalContent}
              </p>
            </Card>
          </details>
        )}
      </div>
    </div>
  )
}