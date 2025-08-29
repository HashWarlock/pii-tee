import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface TypingIndicatorProps {
  isVisible: boolean
  variant?: 'dots' | 'cursor' | 'wave'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  text?: string
}

export function TypingIndicator({ 
  isVisible, 
  variant = 'dots',
  size = 'md',
  className,
  text = 'AI is typing...'
}: TypingIndicatorProps) {
  const [currentDot, setCurrentDot] = useState(0)

  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      setCurrentDot(prev => (prev + 1) % 3)
    }, 500)

    return () => clearInterval(interval)
  }, [isVisible])

  if (!isVisible) return null

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm', 
    lg: 'text-base'
  }

  const dotSizes = {
    sm: 'w-1 h-1',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  }

  const renderDots = () => (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={cn(
            "bg-muted-foreground rounded-full transition-all duration-300",
            dotSizes[size],
            currentDot === index ? "opacity-100 scale-125" : "opacity-40"
          )}
        />
      ))}
    </div>
  )

  const renderCursor = () => (
    <div className="flex items-center">
      <span className={cn("inline-block bg-current animate-pulse", size === 'sm' ? 'w-1 h-3' : size === 'md' ? 'w-1 h-4' : 'w-2 h-5')} />
    </div>
  )

  const renderWave = () => (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={cn(
            "bg-muted-foreground rounded-full animate-bounce",
            dotSizes[size]
          )}
          style={{
            animationDelay: `${index * 0.1}s`,
            animationDuration: '0.6s'
          }}
        />
      ))}
    </div>
  )

  const renderIndicator = () => {
    switch (variant) {
      case 'cursor':
        return renderCursor()
      case 'wave':
        return renderWave()
      default:
        return renderDots()
    }
  }

  return (
    <div className={cn(
      "flex items-center gap-2 text-muted-foreground animate-in fade-in duration-300",
      sizeClasses[size],
      className
    )}>
      {renderIndicator()}
      <span className="select-none">{text}</span>
    </div>
  )
}