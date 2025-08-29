import { useState, useEffect, useRef, useCallback } from 'react'

export interface TypewriterConfig {
  speed?: number // ms per character
  startDelay?: number // ms before starting
  cursorChar?: string
  showCursor?: boolean
  loop?: boolean
  deleteSpeed?: number // ms per character when deleting
  pauseFor?: number // ms to pause between words
}

export interface UseTypewriterReturn {
  displayText: string
  isComplete: boolean
  isTyping: boolean
  reset: () => void
  start: () => void
  pause: () => void
  resume: () => void
}

export function useTypewriter(
  text: string, 
  config: TypewriterConfig = {}
): UseTypewriterReturn {
  const {
    speed = 50,
    startDelay = 0,
    cursorChar = '|',
    showCursor = false,
    loop = false,
    deleteSpeed = 30,
    pauseFor = 1000
  } = config

  const [displayText, setDisplayText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentIndexRef = useRef(0)
  const isForwardRef = useRef(true)
  const hasStartedRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const typeNextCharacter = useCallback(() => {
    if (isPaused) return

    const currentSpeed = isForwardRef.current ? speed : deleteSpeed
    const targetLength = isForwardRef.current ? text.length : 0

    if (isForwardRef.current && currentIndexRef.current < targetLength) {
      // Typing forward
      setDisplayText(text.slice(0, currentIndexRef.current + 1))
      currentIndexRef.current++
      
      timeoutRef.current = setTimeout(typeNextCharacter, currentSpeed)
    } else if (!isForwardRef.current && currentIndexRef.current > targetLength) {
      // Deleting backward
      setDisplayText(text.slice(0, currentIndexRef.current - 1))
      currentIndexRef.current--
      
      timeoutRef.current = setTimeout(typeNextCharacter, currentSpeed)
    } else {
      // Completed current direction
      if (isForwardRef.current) {
        // Finished typing
        setIsComplete(true)
        setIsTyping(false)

        if (loop) {
          // Pause before deleting
          timeoutRef.current = setTimeout(() => {
            isForwardRef.current = false
            setIsComplete(false)
            setIsTyping(true)
            typeNextCharacter()
          }, pauseFor)
        }
      } else {
        // Finished deleting
        isForwardRef.current = true
        setIsComplete(false)
        
        // Pause before typing again
        timeoutRef.current = setTimeout(() => {
          setIsTyping(true)
          typeNextCharacter()
        }, pauseFor / 2)
      }
    }
  }, [text, speed, deleteSpeed, pauseFor, loop, isPaused])

  const start = useCallback(() => {
    if (hasStartedRef.current && !loop) return

    clearTimer()
    setIsTyping(true)
    setIsComplete(false)
    setIsPaused(false)
    hasStartedRef.current = true

    if (startDelay > 0) {
      timeoutRef.current = setTimeout(typeNextCharacter, startDelay)
    } else {
      typeNextCharacter()
    }
  }, [typeNextCharacter, startDelay, loop, clearTimer])

  const pause = useCallback(() => {
    setIsPaused(true)
    clearTimer()
  }, [clearTimer])

  const resume = useCallback(() => {
    if (isComplete && !loop) return
    
    setIsPaused(false)
    typeNextCharacter()
  }, [typeNextCharacter, isComplete, loop])

  const reset = useCallback(() => {
    clearTimer()
    setDisplayText('')
    setIsComplete(false)
    setIsTyping(false)
    setIsPaused(false)
    currentIndexRef.current = 0
    isForwardRef.current = true
    hasStartedRef.current = false
  }, [clearTimer])

  // Auto-start effect
  useEffect(() => {
    if (text && !hasStartedRef.current) {
      start()
    }
  }, [text, start])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  // Update when text changes
  useEffect(() => {
    if (text !== displayText && !isTyping && !isPaused) {
      reset()
      if (text) {
        start()
      }
    }
  }, [text, displayText, isTyping, isPaused, reset, start])

  // Format display text with cursor
  const formattedText = showCursor 
    ? displayText + (isTyping && !isPaused ? cursorChar : '')
    : displayText

  return {
    displayText: formattedText,
    isComplete,
    isTyping,
    reset,
    start,
    pause,
    resume
  }
}