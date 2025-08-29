"use client"

import React from 'react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle,
  Zap,
  Shield
} from "lucide-react"
import { type ConnectionState } from "@/hooks/useConnectionRecovery"

interface ConnectionStatusProps {
  connectionState: ConnectionState
  fallbackMode: boolean
  error: string | null
  retryCount?: number
  maxRetries?: number
  onRetry?: () => void
  onForceReconnect?: () => void
  onEnableFallback?: () => void
  className?: string
  showDetails?: boolean
}

const connectionConfig = {
  connected: {
    icon: CheckCircle,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    label: "Connected",
    variant: "default" as const
  },
  connecting: {
    icon: RefreshCw,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10", 
    label: "Connecting",
    variant: "secondary" as const
  },
  disconnected: {
    icon: WifiOff,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    label: "Disconnected", 
    variant: "secondary" as const
  },
  recovering: {
    icon: RefreshCw,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    label: "Recovering",
    variant: "secondary" as const
  },
  error: {
    icon: AlertTriangle,
    color: "text-red-500", 
    bgColor: "bg-red-500/10",
    label: "Connection Failed",
    variant: "destructive" as const
  }
}

export function ConnectionStatus({
  connectionState,
  fallbackMode,
  error,
  retryCount = 0,
  maxRetries = 3,
  onRetry,
  onForceReconnect,
  onEnableFallback,
  className = "",
  showDetails = false
}: ConnectionStatusProps) {
  const config = connectionConfig[connectionState]
  const Icon = config.icon
  const isAnimated = connectionState === 'connecting' || connectionState === 'recovering'
  
  if (!showDetails && connectionState === 'connected' && !fallbackMode) {
    // Minimal success indicator for normal operation
    return (
      <Badge variant="outline" className={`text-xs ${className}`}>
        <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
        Connected
      </Badge>
    )
  }

  return (
    <Card className={`p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`p-2 rounded-full ${config.bgColor}`}>
            <Icon 
              className={`h-4 w-4 ${config.color} ${isAnimated ? 'animate-spin' : ''}`} 
            />
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Badge variant={config.variant} className="text-xs">
                {config.label}
              </Badge>
              
              {fallbackMode && (
                <Badge variant="outline" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Fallback Mode
                </Badge>
              )}
              
              {retryCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {retryCount}/{maxRetries} retries
                </Badge>
              )}
            </div>
            
            {error && showDetails && (
              <p className="text-xs text-muted-foreground max-w-xs truncate">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {connectionState === 'error' && retryCount < maxRetries && onRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="h-8 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
          
          {(connectionState === 'error' || connectionState === 'disconnected') && onForceReconnect && (
            <Button
              size="sm"
              variant="outline" 
              onClick={onForceReconnect}
              className="h-8 text-xs"
            >
              <Wifi className="h-3 w-3 mr-1" />
              Reconnect
            </Button>
          )}
          
          {connectionState === 'error' && !fallbackMode && onEnableFallback && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onEnableFallback}
              className="h-8 text-xs"
            >
              <Zap className="h-3 w-3 mr-1" />
              Fallback
            </Button>
          )}
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Status:</span>
            <span className="capitalize">{connectionState}</span>
          </div>
          
          {fallbackMode && (
            <div className="flex justify-between">
              <span>Mode:</span>
              <span>Non-streaming fallback active</span>
            </div>
          )}
          
          {retryCount > 0 && (
            <div className="flex justify-between">
              <span>Attempts:</span>
              <span>{retryCount} of {maxRetries}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// Compact inline version for minimal UI footprint
export function ConnectionStatusInline({
  connectionState,
  fallbackMode,
  className = ""
}: Pick<ConnectionStatusProps, 'connectionState' | 'fallbackMode' | 'className'>) {
  const config = connectionConfig[connectionState]
  const Icon = config.icon
  const isAnimated = connectionState === 'connecting' || connectionState === 'recovering'

  return (
    <div className={`flex items-center space-x-1 text-xs ${className}`}>
      <Icon 
        className={`h-3 w-3 ${config.color} ${isAnimated ? 'animate-spin' : ''}`} 
      />
      <span className="text-muted-foreground">
        {config.label}
        {fallbackMode && " (Fallback)"}
      </span>
    </div>
  )
}