"use client"

import React, { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

// Animated button component
interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'bounce' | 'scale' | 'rotate' | 'shake' | 'pulse'
  children: React.ReactNode
  className?: string
}

export function AnimatedButton({ 
  variant = 'scale', 
  children, 
  className,
  onClick,
  ...props 
}: AnimatedButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 300)
    onClick?.(e)
  }, [onClick])

  const animationClasses = {
    bounce: isAnimating ? 'animate-bounce' : '',
    scale: isAnimating ? 'animate-pulse' : 'hover:scale-105 active:scale-95',
    rotate: isAnimating ? 'animate-spin' : 'hover:rotate-3',
    shake: isAnimating ? 'animate-[wiggle_0.3s_ease-in-out]' : '',
    pulse: isAnimating ? 'animate-pulse' : 'hover:animate-pulse'
  }

  return (
    <button
      className={cn(
        "transition-all duration-200 ease-out",
        animationClasses[variant],
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}

// Ripple effect component
interface RippleProps {
  children: React.ReactNode
  className?: string
  color?: string
}

export function Ripple({ children, className, color = 'bg-white/30' }: RippleProps) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([])

  const addRipple = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = Date.now()

    setRipples(prev => [...prev, { id, x, y }])

    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id))
    }, 600)
  }, [])

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onClick={addRipple}
    >
      {children}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className={cn(
            "absolute rounded-full animate-[ripple_0.6s_ease-out] pointer-events-none",
            color
          )}
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 0,
            height: 0,
            transform: 'translate(-50%, -50%)'
          }}
        />
      ))}
    </div>
  )
}

// Hover glow effect
interface HoverGlowProps {
  children: React.ReactNode
  className?: string
  glowColor?: string
  intensity?: 'low' | 'medium' | 'high'
}

export function HoverGlow({ 
  children, 
  className,
  glowColor = 'border-primary',
  intensity = 'medium'
}: HoverGlowProps) {
  const intensityClasses = {
    low: 'hover:shadow-sm',
    medium: 'hover:shadow-md',
    high: 'hover:shadow-lg'
  }

  return (
    <div className={cn(
      "relative transition-all duration-300 ease-out",
      `hover:${glowColor}`,
      intensityClasses[intensity],
      "hover:shadow-primary/20",
      className
    )}>
      {children}
    </div>
  )
}

// Floating label input
interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function FloatingLabelInput({ label, error, className, ...props }: FloatingLabelInputProps) {
  const [focused, setFocused] = useState(false)
  const [hasValue, setHasValue] = useState(false)

  const handleFocus = () => setFocused(true)
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false)
    setHasValue(e.target.value !== '')
  }

  const isLabelFloating = focused || hasValue

  return (
    <div className="relative">
      <input
        className={cn(
          "peer w-full px-3 pt-6 pb-2 border rounded-md bg-background",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          error ? "border-destructive" : "border-input",
          className
        )}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      <label
        className={cn(
          "absolute left-3 transition-all duration-200 pointer-events-none",
          "text-muted-foreground",
          isLabelFloating 
            ? "top-1 text-xs font-medium text-primary" 
            : "top-4 text-sm"
        )}
      >
        {label}
      </label>
      {error && (
        <p className="mt-1 text-sm text-destructive animate-[slideInDown_0.3s_ease-out]">
          {error}
        </p>
      )}
    </div>
  )
}

// Loading dots animation
export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center space-x-1", className)}>
      <div className="w-2 h-2 bg-current rounded-full animate-[bounce_1.4s_ease-in-out_infinite] [animation-delay:-0.32s]" />
      <div className="w-2 h-2 bg-current rounded-full animate-[bounce_1.4s_ease-in-out_infinite] [animation-delay:-0.16s]" />
      <div className="w-2 h-2 bg-current rounded-full animate-[bounce_1.4s_ease-in-out_infinite]" />
    </div>
  )
}

// Smooth reveal animation
interface SmoothRevealProps {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'fade'
}

export function SmoothReveal({ 
  children, 
  className,
  delay = 0,
  direction = 'up'
}: SmoothRevealProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay)
        }
      },
      { threshold: 0.1 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [delay])

  const directionClasses = {
    up: isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
    down: isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0',
    left: isVisible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0',
    right: isVisible ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0',
    fade: isVisible ? 'opacity-100' : 'opacity-0'
  }

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        directionClasses[direction],
        className
      )}
    >
      {children}
    </div>
  )
}

// Progress bar component
interface ProgressBarProps {
  progress: number
  className?: string
  animated?: boolean
  color?: string
}

export function ProgressBar({ 
  progress, 
  className,
  animated = true,
  color = 'bg-primary'
}: ProgressBarProps) {
  return (
    <div className={cn(
      "w-full bg-secondary rounded-full h-2 overflow-hidden",
      className
    )}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          animated && "animate-pulse",
          color
        )}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  )
}

export default AnimatedButton