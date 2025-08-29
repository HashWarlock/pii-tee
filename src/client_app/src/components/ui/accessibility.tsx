"use client"

import React, { useEffect } from 'react'
import { cn } from '@/lib/utils'

// Screen reader only text
interface ScreenReaderOnlyProps {
  children: React.ReactNode
  className?: string
}

export function ScreenReaderOnly({ children, className }: ScreenReaderOnlyProps) {
  return (
    <span className={cn("sr-only", className)}>
      {children}
    </span>
  )
}

// Skip to content link
export function SkipToContent({ targetId = "main-content" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        "absolute left-0 top-0 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-br-md",
        "transform -translate-y-full transition-transform duration-200",
        "focus:translate-y-0"
      )}
    >
      Skip to main content
    </a>
  )
}

// Focus trap component
interface FocusTrapProps {
  children: React.ReactNode
  active?: boolean
  className?: string
}

export function FocusTrap({ children, active = true, className }: FocusTrapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }

    container.addEventListener('keydown', handleTabKey)
    firstElement?.focus()

    return () => {
      container.removeEventListener('keydown', handleTabKey)
    }
  }, [active])

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  )
}

// Announcement component for screen readers
interface AnnouncementProps {
  message: string
  priority?: 'polite' | 'assertive'
  className?: string
}

export function Announcement({ message, priority = 'polite', className }: AnnouncementProps) {
  const [announcement, setAnnouncement] = React.useState('')

  React.useEffect(() => {
    setAnnouncement(message)
    const timer = setTimeout(() => setAnnouncement(''), 1000)
    return () => clearTimeout(timer)
  }, [message])

  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      className={cn("sr-only", className)}
    >
      {announcement}
    </div>
  )
}

// Keyboard navigation helper
interface KeyboardNavigationProps {
  children: React.ReactNode
  onEnter?: () => void
  onEscape?: () => void
  onArrowKeys?: (direction: 'up' | 'down' | 'left' | 'right') => void
  className?: string
}

export function KeyboardNavigation({
  children,
  onEnter,
  onEscape,
  onArrowKeys,
  className
}: KeyboardNavigationProps) {
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        onEnter?.()
        break
      case 'Escape':
        onEscape?.()
        break
      case 'ArrowUp':
        onArrowKeys?.('up')
        e.preventDefault()
        break
      case 'ArrowDown':
        onArrowKeys?.('down')
        e.preventDefault()
        break
      case 'ArrowLeft':
        onArrowKeys?.('left')
        e.preventDefault()
        break
      case 'ArrowRight':
        onArrowKeys?.('right')
        e.preventDefault()
        break
    }
  }, [onEnter, onEscape, onArrowKeys])

  return (
    <div onKeyDown={handleKeyDown} className={className}>
      {children}
    </div>
  )
}

// High contrast mode detector
export function useHighContrastMode() {
  const [isHighContrast, setIsHighContrast] = React.useState(false)

  React.useEffect(() => {
    const checkHighContrast = () => {
      const mediaQuery = window.matchMedia('(prefers-contrast: high)')
      setIsHighContrast(mediaQuery.matches)
    }

    checkHighContrast()
    
    const mediaQuery = window.matchMedia('(prefers-contrast: high)')
    mediaQuery.addEventListener('change', checkHighContrast)
    
    return () => mediaQuery.removeEventListener('change', checkHighContrast)
  }, [])

  return isHighContrast
}

// Reduced motion detector
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const checkReducedMotion = () => {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      setPrefersReducedMotion(mediaQuery.matches)
    }

    checkReducedMotion()
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    mediaQuery.addEventListener('change', checkReducedMotion)
    
    return () => mediaQuery.removeEventListener('change', checkReducedMotion)
  }, [])

  return prefersReducedMotion
}

// ARIA attributes helper
interface AriaProps {
  label?: string
  labelledBy?: string
  describedBy?: string
  expanded?: boolean
  selected?: boolean
  disabled?: boolean
  current?: boolean | 'page' | 'step' | 'location' | 'date' | 'time'
  level?: number
  setSize?: number
  posInSet?: number
  live?: 'off' | 'polite' | 'assertive'
  atomic?: boolean
}

export function getAriaProps({
  label,
  labelledBy,
  describedBy,
  expanded,
  selected,
  disabled,
  current,
  level,
  setSize,
  posInSet,
  live,
  atomic
}: AriaProps) {
  const props: Record<string, string | number | boolean> = {}

  if (label) props['aria-label'] = label
  if (labelledBy) props['aria-labelledby'] = labelledBy
  if (describedBy) props['aria-describedby'] = describedBy
  if (expanded !== undefined) props['aria-expanded'] = expanded
  if (selected !== undefined) props['aria-selected'] = selected
  if (disabled !== undefined) props['aria-disabled'] = disabled
  if (current !== undefined) props['aria-current'] = current
  if (level) props['aria-level'] = level
  if (setSize) props['aria-setsize'] = setSize
  if (posInSet) props['aria-posinset'] = posInSet
  if (live) props['aria-live'] = live
  if (atomic !== undefined) props['aria-atomic'] = atomic

  return props
}

// Color contrast checker (for development)
export function checkColorContrast(foreground: string, background: string): {
  ratio: number
  wcagAA: boolean
  wcagAAA: boolean
} {
  // This is a simplified version - in production you might want to use a proper color library
  const getLuminance = (color: string): number => {
    // Very simplified - real implementation would parse CSS colors properly
    return 0.5 // Placeholder
  }

  const fg = getLuminance(foreground)
  const bg = getLuminance(background)
  const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)

  return {
    ratio,
    wcagAA: ratio >= 4.5,
    wcagAAA: ratio >= 7
  }
}

export default ScreenReaderOnly