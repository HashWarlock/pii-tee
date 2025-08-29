"use client"

import React, { useState, useCallback } from 'react'
import { NavigationProvider } from '@/contexts/navigation-context'
import { useAnonymize } from '@/hooks/useAnonymize'
import { useDeanonymize } from '@/hooks/useDeanonymize'
import { useVerify } from '@/hooks/useVerify'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageDetails } from '@/components/message-details'
import { Send, Shield, User, Bot, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getApiUrl } from '@/lib/runtime-config'

interface Message {
  id: string
  content: string
  timestamp: Date
  sessionId?: string
  type: 'human' | 'llm'
  isAnonymized?: boolean
  originalContent?: string
  metadata?: Record<string, unknown>
  apiResponse?: {
    session_id?: string
    text: string
    quote?: string | null
    signature?: string | null
    public_key?: string | null
    signing_method?: string | null
  }
}

interface VerificationRecord {
  id: string
  messageId: string
  content: string
  quote?: string
  signature?: string
  publicKey?: string
  signingMethod?: string
  timestamp: Date
  status: 'pending' | 'verified' | 'failed'
  messageType: 'human' | 'llm'
  apiResponse?: {
    session_id?: string
    text: string
    quote?: string | null
    signature?: string | null
    public_key?: string | null
    signing_method?: string | null
  }
}

export default function ChatPage() {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [humanMessages, setHumanMessages] = useState<Message[]>([])
  const [llmMessages, setLLMMessages] = useState<Message[]>([])
  const [verificationRecords, setVerificationRecords] = useState<VerificationRecord[]>([])
  const [humanInput, setHumanInput] = useState('')
  const [llmInput, setLLMInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Hooks for API interactions
  const anonymize = useAnonymize()
  const deanonymize = useDeanonymize()
  const verify = useVerify()

  // Handle human message submission
  const handleHumanSubmit = useCallback(async () => {
    if (!humanInput.trim() || isProcessing) return

    setIsProcessing(true)
    const messageId = Date.now().toString()
    const originalMessage = humanInput.trim()

    console.log('Submitting message:', originalMessage)
    console.log('Current session ID:', sessionId)
    console.log('API URL:', process.env.NEXT_PUBLIC_API_URL)

    try {
      // Add original message to human view
      const humanMessage: Message = {
        id: messageId,
        content: originalMessage,
        timestamp: new Date(),
        type: 'human',
        originalContent: originalMessage
      }
      setHumanMessages(prev => [...prev, humanMessage])
      setHumanInput('')

      // Anonymize the text
      console.log('Calling anonymize API...')
      const result = await anonymize.anonymize(originalMessage, 'en', sessionId || undefined)
      console.log('Anonymize API response:', result)
      
      if (result.success && result.data) {
        // Update session ID if new
        if (!sessionId && result.data.session_id) {
          setSessionId(result.data.session_id)
        }

        // Add anonymized message to LLM view
        const llmMessage: Message = {
          id: `${messageId}-anon`,
          content: result.data.text,
          timestamp: new Date(),
          type: 'human',
          isAnonymized: true,
          originalContent: originalMessage,
          sessionId: result.data.session_id,
          apiResponse: result.data  // Store full API response
        }
        setLLMMessages(prev => [...prev, llmMessage])

        // Add verification record if signature exists
        if (result.data.signature) {
          const verificationRecord: VerificationRecord = {
            id: `${messageId}-verify-${Date.now()}`,
            messageId: messageId,
            content: result.data.text,
            quote: result.data.quote,
            signature: result.data.signature,
            publicKey: result.data.public_key,
            signingMethod: result.data.signing_method,
            timestamp: new Date(),
            status: 'pending',
            messageType: 'human',
            apiResponse: result.data  // Store full API response
          }
          setVerificationRecords(prev => [...prev, verificationRecord])

          // Verify the signature asynchronously
          if (result.data.signature && result.data.public_key) {
            // Use the signing method from the API response, don't default to 'ecdsa'
            const signingMethod = result.data.signing_method || 'ed25519'
            
            console.log('[Chat] Verifying signature:', {
              contentLength: result.data.text.length,
              signatureLength: result.data.signature.length,
              publicKeyLength: result.data.public_key.length,
              signingMethod: signingMethod,
              rawSigningMethod: result.data.signing_method
            })
            
            // Perform verification - pass the exact signing method from API
            verify.verifySignature({
              content: result.data.text,
              signature: result.data.signature,
              public_key: result.data.public_key,
              signing_method: signingMethod
            }).then(verifyResult => {
              if (verifyResult && verifyResult.data?.is_valid !== undefined) {
                setVerificationRecords(prev => 
                  prev.map(r => r.id === verificationRecord.id 
                    ? { ...r, status: verifyResult.data.is_valid === true ? 'verified' : 'failed' } 
                    : r
                  )
                )
              } else {
                // If verification fails or returns unexpected result
                setVerificationRecords(prev => 
                  prev.map(r => r.id === verificationRecord.id 
                    ? { ...r, status: 'failed' } 
                    : r
                  )
                )
              }
            }).catch(error => {
              console.error('Signature verification error:', error)
              setVerificationRecords(prev => 
                prev.map(r => r.id === verificationRecord.id 
                  ? { ...r, status: 'failed' } 
                  : r
                )
              )
            })
          }
        }

        // In auto mode, simulate LLM response
        if (mode === 'auto' && result.data) {
          const { text, session_id } = result.data
          setTimeout(() => {
            handleLLMResponse(text, session_id)
          }, 1000)
        }
      } else {
        console.error('Anonymize failed:', result)
      }
    } catch (error) {
      console.error('Failed to process message:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
    } finally {
      setIsProcessing(false)
    }
  }, [humanInput, sessionId, mode, isProcessing, anonymize, verify])

  // Handle LLM response (simulated or manual)
  const handleLLMResponse = useCallback(async (anonymizedText: string, currentSessionId: string) => {
    // In a real implementation, this would call the LLM API
    // For now, we'll simulate a response
    const responseId = `llm-${Date.now()}`
    const llmResponse = `I received your anonymized message: "${anonymizedText}". This is a simulated response.`

    const llmMessage: Message = {
      id: responseId,
      content: llmResponse,
      timestamp: new Date(),
      type: 'llm',
      sessionId: currentSessionId
    }
    setLLMMessages(prev => [...prev, llmMessage])

    // Deanonymize the response for human view
    if (currentSessionId) {
      try {
        const result = await deanonymize.deanonymize(llmResponse, currentSessionId)
        if (result) {
          const humanMessage: Message = {
            id: `${responseId}-deanon`,
            content: result.text,
            timestamp: new Date(),
            type: 'llm',
            sessionId: currentSessionId,
            originalContent: llmResponse,
            apiResponse: result  // Store full deanonymize response
          }
          setHumanMessages(prev => [...prev, humanMessage])
          
          // Add verification record for deanonymization if signature exists
          if (result.signature) {
            const verificationRecord: VerificationRecord = {
              id: `${responseId}-verify-${Date.now()}`,
              messageId: responseId,
              content: result.text,
              quote: result.quote,
              signature: result.signature,
              publicKey: result.public_key,
              signingMethod: result.signing_method,
              timestamp: new Date(),
              status: 'pending',
              messageType: 'llm',
              apiResponse: result
            }
            setVerificationRecords(prev => [...prev, verificationRecord])
            
            // Verify the deanonymization signature
            if (result.public_key) {
              const signingMethod = result.signing_method || 'ecdsa'
              verify.verifySignature({
                content: result.text,
                signature: result.signature,
                public_key: result.public_key,
                signing_method: signingMethod
              }).then(verifyResult => {
                if (verifyResult && verifyResult.data?.is_valid !== undefined) {
                  setVerificationRecords(prev => 
                    prev.map(r => r.id === verificationRecord.id 
                      ? { ...r, status: verifyResult.data.is_valid === true ? 'verified' : 'failed' } 
                      : r
                    )
                  )
                }
              }).catch(error => {
                console.error('Deanonymization signature verification error:', error)
                setVerificationRecords(prev => 
                  prev.map(r => r.id === verificationRecord.id 
                    ? { ...r, status: 'failed' } 
                    : r
                  )
                )
              })
            }
          }
        }
      } catch (error) {
        console.error('Failed to deanonymize response:', error)
      }
    }
  }, [deanonymize, verify])

  // Handle manual LLM input
  const handleLLMSubmit = useCallback(async () => {
    if (!llmInput.trim() || isProcessing || mode !== 'manual' || !sessionId) return

    setIsProcessing(true)
    const messageId = `llm-manual-${Date.now()}`

    try {
      // Add to LLM view
      const llmMessage: Message = {
        id: messageId,
        content: llmInput.trim(),
        timestamp: new Date(),
        type: 'llm',
        sessionId
      }
      setLLMMessages(prev => [...prev, llmMessage])
      setLLMInput('')

      // Deanonymize for human view
      const result = await deanonymize.deanonymize(llmInput.trim(), sessionId)
      if (result) {
        const humanMessage: Message = {
          id: `${messageId}-deanon`,
          content: result.text,
          timestamp: new Date(),
          type: 'llm',
          sessionId,
          originalContent: llmInput.trim()
        }
        setHumanMessages(prev => [...prev, humanMessage])
      }
    } catch (error) {
      console.error('Failed to process LLM message:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [llmInput, sessionId, mode, isProcessing, deanonymize])

  return (
    <NavigationProvider>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">PII-TEE Anonymous Chat</h1>
            </div>
            <div className="flex items-center gap-4">
              {sessionId && (
                <Badge variant="outline">
                  Session: {sessionId.slice(0, 8)}...
                </Badge>
              )}
              <Badge variant={mode === 'auto' ? 'default' : 'secondary'}>
                {mode === 'auto' ? 'Auto Mode' : 'Manual Mode'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode(mode === 'auto' ? 'manual' : 'auto')}
              >
                Switch to {mode === 'auto' ? 'Manual' : 'Auto'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const apiUrl = getApiUrl()
                  console.log('[DEBUG] Current API URL:', apiUrl)
                  alert(`API URL: ${apiUrl}`)
                }}
              >
                Debug API URL
              </Button>
            </div>
          </div>

          {/* Three Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Human View */}
            <Card className="h-[calc(100vh-12rem)]">
              <div className="p-4 border-b">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <h2 className="font-semibold">Human View</h2>
                </div>
              </div>
              <ScrollArea className="flex-1 h-[calc(100%-8rem)] p-4">
                {humanMessages.map((msg) => (
                  msg.apiResponse ? (
                    <MessageDetails 
                      key={msg.id}
                      type="deanonymize"
                      data={msg.apiResponse}
                      timestamp={msg.timestamp}
                      verificationStatus={
                        verificationRecords.find(r => r.messageId === msg.id.replace('-deanon', ''))?.status
                      }
                    />
                  ) : (
                    <div
                      key={msg.id}
                      className={cn(
                        "mb-4 p-3 rounded-lg",
                        msg.type === 'human' 
                          ? "bg-primary/10 ml-auto max-w-[80%]" 
                          : "bg-muted max-w-[80%]"
                      )}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <span className="text-xs text-muted-foreground">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  )
                ))}
              </ScrollArea>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={humanInput}
                    onChange={(e) => setHumanInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleHumanSubmit()}
                    placeholder="Enter text..."
                    disabled={isProcessing}
                  />
                  <Button
                    onClick={handleHumanSubmit}
                    disabled={isProcessing || !humanInput.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* LLM View */}
            <Card className="h-[calc(100vh-12rem)]">
              <div className="p-4 border-b">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  <h2 className="font-semibold">LLM View</h2>
                </div>
              </div>
              <ScrollArea className="flex-1 h-[calc(100%-8rem)] p-4">
                {llmMessages.map((msg) => (
                  msg.apiResponse && msg.isAnonymized ? (
                    <MessageDetails 
                      key={msg.id}
                      type="anonymize"
                      data={msg.apiResponse}
                      timestamp={msg.timestamp}
                      verificationStatus={
                        verificationRecords.find(r => r.messageId === msg.id.replace('-anon', ''))?.status
                      }
                    />
                  ) : (
                    <div
                      key={msg.id}
                      className={cn(
                        "mb-4 p-3 rounded-lg",
                        msg.type === 'human' 
                          ? "bg-primary/10 ml-auto max-w-[80%]" 
                          : "bg-muted max-w-[80%]"
                      )}
                    >
                      <p className="text-sm">{msg.content}</p>
                      {msg.isAnonymized && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          Anonymized
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground block mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  )
                ))}
              </ScrollArea>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={llmInput}
                    onChange={(e) => setLLMInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLLMSubmit()}
                    placeholder={mode === 'manual' ? "Enter text..." : "Use manual mode to chat as LLM"}
                    disabled={isProcessing || mode !== 'manual'}
                  />
                  <Button
                    onClick={handleLLMSubmit}
                    disabled={isProcessing || !llmInput.trim() || mode !== 'manual'}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Verification View */}
            <Card className="h-[calc(100vh-12rem)]">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    <h2 className="font-semibold">Message Signature Verification</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Total: {verificationRecords.length}
                    </Badge>
                    <Badge variant="default" className="text-xs">
                      ✓ {verificationRecords.filter(r => r.status === 'verified').length}
                    </Badge>
                    {verificationRecords.filter(r => r.status === 'failed').length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        ✗ {verificationRecords.filter(r => r.status === 'failed').length}
                      </Badge>
                    )}
                    {verificationRecords.filter(r => r.status === 'pending').length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        ⏳ {verificationRecords.filter(r => r.status === 'pending').length}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1 h-[calc(100%-4rem)] p-4">
                {verificationRecords.map((record) => (
                  <div key={record.id} className="mb-4 p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            record.status === 'verified' ? "default" : 
                            record.status === 'failed' ? "destructive" : 
                            "secondary"
                          }
                        >
                          {record.status === 'verified' ? "✓ Verified" : 
                           record.status === 'failed' ? "✗ Failed" : 
                           "⏳ Pending"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {record.messageType === 'human' ? 'Human' : 'LLM'}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {record.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Message: {record.content.substring(0, 50)}...
                    </p>
                    {record.signature && (
                      <div className="text-xs space-y-1">
                        <div>
                          <span className="font-semibold">Method:</span> {record.signingMethod ? record.signingMethod.toUpperCase() : 'Unknown'}
                        </div>
                        <div>
                          <span className="font-semibold">Signature:</span> {record.signature.substring(0, 20)}...
                        </div>
                        {record.publicKey && (
                          <div>
                            <span className="font-semibold">Public Key:</span> {record.publicKey.substring(0, 20)}...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {verificationRecords.length === 0 && (
                  <p className="text-center text-muted-foreground">
                    No verification records yet. Send a message to see signature verification.
                  </p>
                )}
              </ScrollArea>
            </Card>
          </div>
        </div>
      </div>
    </NavigationProvider>
  )
}