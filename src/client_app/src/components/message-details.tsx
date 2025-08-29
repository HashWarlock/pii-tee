"use client"

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Copy, Check, Shield, Key, Hash, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageDetailsProps {
  type: 'anonymize' | 'deanonymize'
  data: {
    session_id?: string
    text: string
    quote?: string | null
    signature?: string | null
    public_key?: string | null
    signing_method?: string | null
  }
  timestamp: Date
  verificationStatus?: 'pending' | 'verified' | 'failed'
}

export function MessageDetails({ type, data, timestamp, verificationStatus }: MessageDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const formatValue = (value: string | null | undefined, maxLength: number = 50) => {
    if (!value) return 'N/A'
    if (value.length <= maxLength) return value
    return `${value.substring(0, maxLength)}...`
  }

  return (
    <Card className="mb-4 p-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-semibold capitalize">{type}</span>
            {verificationStatus && (
              <Badge 
                variant={
                  verificationStatus === 'verified' ? "default" : 
                  verificationStatus === 'failed' ? "destructive" : 
                  "secondary"
                }
                className="text-xs"
              >
                {verificationStatus === 'verified' ? "✓ Verified" : 
                 verificationStatus === 'failed' ? "✗ Failed" : 
                 "⏳ Pending"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {timestamp.toLocaleTimeString()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Message Content */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm">{data.text}</p>
        </div>

        {/* Quick Info */}
        <div className="flex flex-wrap gap-2">
          {data.session_id && (
            <Badge variant="outline" className="text-xs">
              Session: {data.session_id.substring(0, 8)}...
            </Badge>
          )}
          {data.signing_method && (
            <Badge variant="outline" className="text-xs">
              {data.signing_method.toUpperCase()}
            </Badge>
          )}
          {data.signature && (
            <Badge variant="outline" className="text-xs">
              Signed
            </Badge>
          )}
          {data.quote && (
            <Badge variant="outline" className="text-xs">
              TEE Attested
            </Badge>
          )}
        </div>

        {/* Expandable Details */}
        {isExpanded && (
          <div className="space-y-3 pt-3 border-t">
            {/* Session ID */}
            {data.session_id && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-semibold">Session ID</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(data.session_id!, 'session')}
                    className="h-6 px-2"
                  >
                    {copiedField === 'session' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="bg-muted/30 rounded p-2 break-all">
                  <code className="text-xs">{data.session_id}</code>
                </div>
              </div>
            )}

            {/* Public Key */}
            {data.public_key && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-semibold">Public Key</span>
                    {data.signing_method && (
                      <Badge variant="outline" className="text-xs">
                        {data.signing_method.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(data.public_key!, 'publicKey')}
                    className="h-6 px-2"
                  >
                    {copiedField === 'publicKey' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="bg-muted/30 rounded p-2 break-all">
                  <code className="text-xs font-mono">{data.public_key}</code>
                </div>
              </div>
            )}

            {/* Signature */}
            {data.signature && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-semibold">Signature</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(data.signature!, 'signature')}
                    className="h-6 px-2"
                  >
                    {copiedField === 'signature' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="bg-muted/30 rounded p-2 break-all">
                  <code className="text-xs font-mono">{data.signature}</code>
                </div>
              </div>
            )}

            {/* TEE Quote */}
            {data.quote && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-semibold">TEE Quote</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(data.quote!, 'quote')}
                    className="h-6 px-2"
                  >
                    {copiedField === 'quote' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="bg-muted/30 rounded p-2 break-all max-h-32 overflow-y-auto">
                  <code className="text-xs font-mono">
                    {data.quote.length > 500 ? 
                      `${data.quote.substring(0, 500)}... (${data.quote.length} chars total)` : 
                      data.quote
                    }
                  </code>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}