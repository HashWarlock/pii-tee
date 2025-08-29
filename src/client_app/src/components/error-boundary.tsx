"use client"

import React, { Component, ReactNode } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, RefreshCw, Bug, Home } from "lucide-react"

interface ErrorInfo {
  componentStack: string
  errorBoundary?: string
  errorInfo?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
  retryCount: number
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  maxRetries?: number
  showErrorDetails?: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: this.generateErrorId(),
      retryCount: 0
    }
  }

  private generateErrorId(): string {
    return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const enhancedErrorInfo: ErrorInfo = {
      componentStack: errorInfo.componentStack || '',
      errorBoundary: this.constructor.name,
      errorInfo: JSON.stringify(errorInfo, null, 2)
    }

    this.setState({
      errorInfo: enhancedErrorInfo
    })

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error Boundary - ${this.state.errorId}`)
      console.error('Error:', error)
      console.error('Error Info:', errorInfo)
      console.error('Component Stack:', errorInfo.componentStack)
      console.groupEnd()
    }

    // Call custom error handler
    this.props.onError?.(error, enhancedErrorInfo)
  }

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props
    
    if (this.state.retryCount >= maxRetries) {
      return
    }

    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1
    }))

    // Clear retry timeout if it exists
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }

    // Retry after a short delay
    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: this.generateErrorId()
      })
    }, 1000)
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: this.generateErrorId(),
      retryCount: 0
    })
  }

  private getErrorSeverity(error: Error | null): 'low' | 'medium' | 'high' {
    if (!error) return 'low'
    
    // Check error types for severity
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return 'medium' // Usually recoverable
    }
    
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return 'medium' // Network issues
    }
    
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 'high' // Code issues
    }
    
    return 'medium'
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  render() {
    if (this.state.hasError) {
      const { fallback, maxRetries = 3, showErrorDetails = false } = this.props
      const { error, errorId, retryCount } = this.state
      const severity = this.getErrorSeverity(error)
      const canRetry = retryCount < maxRetries

      // Use custom fallback if provided
      if (fallback) {
        return fallback
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="w-full max-w-md p-6 text-center space-y-4">
            <div className="space-y-2">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Something went wrong</h3>
                <p className="text-sm text-muted-foreground">
                  We encountered an unexpected error while loading this component.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Badge 
                variant={severity === 'high' ? 'destructive' : severity === 'medium' ? 'secondary' : 'outline'}
                className="text-xs"
              >
                <Bug className="h-3 w-3 mr-1" />
                {severity.toUpperCase()} SEVERITY
              </Badge>
              
              <Badge variant="outline" className="text-xs">
                ID: {errorId}
              </Badge>
            </div>

            {showErrorDetails && error && (
              <details className="text-left text-xs bg-muted p-3 rounded-lg">
                <summary className="cursor-pointer font-medium mb-2">
                  Error Details
                </summary>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Error:</span> {error.name}
                  </div>
                  <div>
                    <span className="font-medium">Message:</span> {error.message}
                  </div>
                  {process.env.NODE_ENV === 'development' && error.stack && (
                    <div>
                      <span className="font-medium">Stack:</span>
                      <pre className="text-xs mt-1 overflow-auto max-h-32">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-2 justify-center">
              {canRetry && (
                <Button 
                  onClick={this.handleRetry}
                  size="sm"
                  variant="default"
                  disabled={false}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry ({maxRetries - retryCount} left)
                </Button>
              )}
              
              <Button 
                onClick={this.handleReset}
                size="sm"
                variant="outline"
              >
                <Home className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>

            {retryCount >= maxRetries && (
              <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
                <p>
                  <strong>Maximum retries exceeded.</strong><br />
                  Please refresh the page or contact support if the problem persists.
                </p>
              </div>
            )}
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Functional hook version for use with React hooks
export function useErrorBoundary() {
  return {
    captureError: (error: Error) => {
      // This will trigger the nearest error boundary
      throw error
    }
  }
}