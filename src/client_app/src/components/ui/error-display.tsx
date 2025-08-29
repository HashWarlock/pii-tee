"use client"

import React from 'react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { 
  AlertTriangle, 
  RefreshCw, 
  Wifi, 
  Clock,
  Shield,
  Info,
  X,
  ExternalLink
} from "lucide-react"
import { ApiError } from '@/types/api'

export interface ErrorDisplayProps {
  error: ApiError
  onRetry?: () => void
  onDismiss?: () => void
  onReconnect?: () => void
  canRetry?: boolean
  showDetails?: boolean
  className?: string
  variant?: 'inline' | 'card' | 'toast'
}

const getErrorSeverity = (status: number): 'low' | 'medium' | 'high' => {
  if (status === 0) return 'high' // Network error
  if (status >= 500) return 'high' // Server error
  if (status >= 400 && status < 500) return 'medium' // Client error
  return 'low'
}

const getErrorCategory = (status: number): {
  category: string
  icon: React.ElementType
  color: string
  suggestions: string[]
} => {
  if (status === 0) {
    return {
      category: 'Network Error',
      icon: Wifi,
      color: 'text-red-500',
      suggestions: [
        'Check your internet connection',
        'Try again in a moment',
        'Contact support if issue persists'
      ]
    }
  }
  
  if (status === 408 || status === 504) {
    return {
      category: 'Timeout',
      icon: Clock,
      color: 'text-orange-500',
      suggestions: [
        'The request took too long',
        'Try again with a shorter message',
        'Check your connection speed'
      ]
    }
  }
  
  if (status >= 500) {
    return {
      category: 'Server Error',
      icon: AlertTriangle,
      color: 'text-red-500',
      suggestions: [
        'This is a temporary server issue',
        'Please try again in a few minutes',
        'Contact support if problem continues'
      ]
    }
  }
  
  if (status === 401 || status === 403) {
    return {
      category: 'Authentication',
      icon: Shield,
      color: 'text-yellow-500',
      suggestions: [
        'Your session may have expired',
        'Try refreshing the page',
        'Sign in again if needed'
      ]
    }
  }
  
  if (status >= 400 && status < 500) {
    return {
      category: 'Request Error',
      icon: Info,
      color: 'text-blue-500',
      suggestions: [
        'Please check your input',
        'Make sure all required fields are filled',
        'Try a different approach'
      ]
    }
  }
  
  return {
    category: 'Unknown Error',
    icon: AlertTriangle,
    color: 'text-gray-500',
    suggestions: ['Please try again or contact support']
  }
}

const formatTimestamp = (timestamp: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(timestamp)
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  onReconnect,
  canRetry = true,
  showDetails = false,
  className = '',
  variant = 'card'
}: ErrorDisplayProps) {
  const severity = getErrorSeverity(error.status)
  const { category, icon: Icon, color, suggestions } = getErrorCategory(error.status)

  const actions = (
    <div className="flex items-center space-x-2 mt-3">
      {canRetry && onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="h-8"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
      
      {error.status === 0 && onReconnect && (
        <Button
          size="sm"
          variant="outline"
          onClick={onReconnect}
          className="h-8"
        >
          <Wifi className="h-3 w-3 mr-1" />
          Reconnect
        </Button>
      )}
      
      {onDismiss && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-8"
        >
          <X className="h-3 w-3 mr-1" />
          Dismiss
        </Button>
      )}
    </div>
  )

  const errorContent = (
    <div className="space-y-3">
      <div className="flex items-start space-x-3">
        <div className={`p-2 rounded-full bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center space-x-2">
            <h4 className="font-medium text-sm">{category}</h4>
            <Badge 
              variant={severity === 'high' ? 'destructive' : severity === 'medium' ? 'secondary' : 'outline'}
              className="text-xs"
            >
              {severity.toUpperCase()}
            </Badge>
            {error.status > 0 && (
              <Badge variant="outline" className="text-xs">
                {error.status}
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            {error.message}
          </p>
          
          {suggestions.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Suggestions:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start space-x-1">
                    <span className="text-muted-foreground">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      
      {showDetails && (
        <details className="text-xs bg-muted p-3 rounded-lg">
          <summary className="cursor-pointer font-medium mb-2">
            Technical Details
          </summary>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Status Code:</span>
              <span>{error.status || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Timestamp:</span>
              <span>{formatTimestamp(error.timestamp)}</span>
            </div>
            {error.details && (
              <div>
                <span className="font-medium">Details:</span>
                <pre className="text-xs mt-1 overflow-auto max-h-32 bg-background p-2 rounded">
                  {error.details}
                </pre>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  )

  if (variant === 'inline') {
    return (
      <Alert className={className}>
        <Icon className="h-4 w-4" />
        <AlertTitle>{category}</AlertTitle>
        <AlertDescription>
          {error.message}
          {actions}
        </AlertDescription>
      </Alert>
    )
  }

  if (variant === 'toast') {
    return (
      <div className={`bg-background border rounded-lg p-4 shadow-lg ${className}`}>
        <div className="flex items-start space-x-3">
          <Icon className={`h-5 w-5 ${color} mt-0.5`} />
          <div className="flex-1">
            <p className="font-medium text-sm">{category}</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {(onRetry || onReconnect) && (
          <div className="flex items-center space-x-2 mt-3">
            {canRetry && onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry} className="h-7 text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            {error.status === 0 && onReconnect && (
              <Button size="sm" variant="outline" onClick={onReconnect} className="h-7 text-xs">
                <Wifi className="h-3 w-3 mr-1" />
                Reconnect
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className={`p-4 border-destructive/20 ${className}`}>
      {errorContent}
      {actions}
    </Card>
  )
}

// Compact error display for minimal UI footprint
export function ErrorDisplayCompact({
  error,
  onRetry,
  onDismiss,
  className = ''
}: Pick<ErrorDisplayProps, 'error' | 'onRetry' | 'onDismiss' | 'className'>) {
  const { icon: Icon, color } = getErrorCategory(error.status)

  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      <Icon className={`h-4 w-4 ${color}`} />
      <span className="text-muted-foreground flex-1">{error.message}</span>
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry} className="h-6 w-6 p-0">
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
      {onDismiss && (
        <Button size="sm" variant="ghost" onClick={onDismiss} className="h-6 w-6 p-0">
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

export default ErrorDisplay