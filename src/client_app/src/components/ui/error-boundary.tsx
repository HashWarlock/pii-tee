"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Card } from './card'
import { Button } from './button'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showErrorDetails?: boolean
  className?: string
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })
    
    // Call the onError prop if provided
    this.props.onError?.(error, errorInfo)
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReportError = () => {
    const error = this.state.error
    const errorInfo = this.state.errorInfo
    
    // You could integrate with error reporting services here
    // For now, copy to clipboard
    const errorReport = `
Error: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
    `.trim()
    
    navigator.clipboard.writeText(errorReport).then(() => {
      alert('Error details copied to clipboard')
    })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-lg w-full p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Something went wrong
              </h1>
              <p className="text-muted-foreground">
                We encountered an unexpected error. Don&apos;t worry, your data is safe.
              </p>
            </div>

            {this.props.showErrorDetails && this.state.error && (
              <details className="text-left bg-muted rounded-md p-4 text-sm">
                <summary className="cursor-pointer font-medium mb-2">
                  Error Details
                </summary>
                <div className="space-y-2">
                  <div>
                    <strong>Message:</strong> {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 text-xs overflow-x-auto">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 text-xs overflow-x-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={this.handleReset}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Try Again</span>
              </Button>
              
              <Button 
                variant="outline"
                onClick={this.handleReload}
                className="flex items-center space-x-2"
              >
                <Home className="h-4 w-4" />
                <span>Reload Page</span>
              </Button>
              
              {process.env.NODE_ENV === 'development' && (
                <Button 
                  variant="outline"
                  onClick={this.handleReportError}
                  className="flex items-center space-x-2"
                >
                  <Bug className="h-4 w-4" />
                  <span>Copy Error</span>
                </Button>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              If this problem persists, please contact support with the error details above.
            </p>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook version for functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null)
  
  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])
  
  const throwError = React.useCallback((error: Error) => {
    setError(error)
  }, [])
  
  return throwError
}

export default ErrorBoundary