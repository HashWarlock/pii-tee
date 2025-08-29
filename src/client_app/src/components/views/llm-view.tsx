"use client"

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { 
  Bot, 
  Search,
  Filter,
  Clock,
  Eye,
  EyeOff,
  Copy,
  Download,
  CheckCircle,
  X,
  ArrowRight,
  MessageSquare
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface LLMMessage {
  id: string
  sessionId: string
  humanMessageId?: string
  
  // LLM Response
  response: string
  responseTimestamp: Date
  
  // Context (what was sent to LLM)
  anonymizedInput: string
  originalInput: string
  inputTimestamp: Date
  
  // Anonymization info
  anonymizationMetadata?: {
    entitiesFound: Array<{
      type: string
      original: string
      anonymized: string
      start: number
      end: number
    }>
    language?: string
    processingTime?: number
  }
  
  // Response metadata
  metadata?: {
    model?: string
    responseTime?: number
    tokenCount?: number
    characterCount?: number
    wordCount?: number
  }
}

export interface LLMViewProps {
  messages: LLMMessage[]
  onSelectMessage?: (message: LLMMessage) => void
  onCopyMessage?: (message: LLMMessage, type: 'response' | 'input') => void
  onExportMessages?: (messages: LLMMessage[]) => void
  onDeanonymizeMessage?: (message: LLMMessage) => Promise<void>
  className?: string
  searchPlaceholder?: string
  emptyStateMessage?: string
  showAnonymizationDetails?: boolean
}

type SortOption = 'newest' | 'oldest' | 'longest-response' | 'shortest-response' | 'most-entities'
type FilterOption = 'all' | 'today' | 'week' | 'month' | 'with-pii' | 'deanonymized'

const formatTimestamp = (timestamp: Date): string => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    return `Today, ${timestamp.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`
  } else if (days === 1) {
    return `Yesterday, ${timestamp.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`
  } else if (days < 7) {
    return timestamp.toLocaleDateString('en-US', { 
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit'
    })
  } else {
    return timestamp.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric',
      year: timestamp.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

const getRelativeTime = (timestamp: Date): string => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function LLMView({
  messages,
  onSelectMessage,
  onCopyMessage,
  onExportMessages,
  onDeanonymizeMessage,
  className = '',
  searchPlaceholder = "Search LLM responses...",
  emptyStateMessage = "No LLM responses yet. Start a conversation to see AI responses here.",
  showAnonymizationDetails = true
}: LLMViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [showAnonymized, setShowAnonymized] = useState(true)
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null)
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Filtered and sorted messages
  const processedMessages = useMemo(() => {
    let filtered = messages

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(message => 
        message.response.toLowerCase().includes(query) ||
        message.anonymizedInput.toLowerCase().includes(query) ||
        message.originalInput.toLowerCase().includes(query) ||
        message.sessionId.toLowerCase().includes(query)
      )
    }

    // Apply date/content filters
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())

    filtered = filtered.filter(message => {
      switch (filterBy) {
        case 'today':
          return message.responseTimestamp >= today
        case 'week':
          return message.responseTimestamp >= weekAgo
        case 'month':
          return message.responseTimestamp >= monthAgo
        case 'with-pii':
          return (message.anonymizationMetadata?.entitiesFound?.length || 0) > 0
        case 'deanonymized':
          return expandedMessageId === message.id
        default:
          return true
      }
    })

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.responseTimestamp.getTime() - a.responseTimestamp.getTime()
        case 'oldest':
          return a.responseTimestamp.getTime() - b.responseTimestamp.getTime()
        case 'longest-response':
          return b.response.length - a.response.length
        case 'shortest-response':
          return a.response.length - b.response.length
        case 'most-entities':
          return (b.anonymizationMetadata?.entitiesFound?.length || 0) - 
                 (a.anonymizationMetadata?.entitiesFound?.length || 0)
        default:
          return 0
      }
    })
  }, [messages, searchQuery, sortBy, filterBy, expandedMessageId])

  // Handle message selection
  const toggleMessageSelection = useCallback((messageId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }, [])

  // Handle copy message
  const handleCopyMessage = useCallback(async (message: LLMMessage, type: 'response' | 'input') => {
    try {
      const content = type === 'response' ? message.response : 
                     showAnonymized ? message.anonymizedInput : message.originalInput
      await navigator.clipboard.writeText(content)
      onCopyMessage?.(message, type)
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }, [onCopyMessage, showAnonymized])

  // Handle export selected messages
  const handleExportSelected = useCallback(() => {
    const selectedMessageData = messages.filter(msg => selectedMessages.has(msg.id))
    onExportMessages?.(selectedMessageData)
  }, [messages, selectedMessages, onExportMessages])

  // Handle message expansion/deanonymization
  const handleToggleExpanded = useCallback(async (message: LLMMessage) => {
    if (expandedMessageId === message.id) {
      setExpandedMessageId(null)
    } else {
      setExpandedMessageId(message.id)
      if (onDeanonymizeMessage) {
        try {
          await onDeanonymizeMessage(message)
        } catch (error) {
          console.error('Failed to deanonymize message:', error)
        }
      }
    }
  }, [expandedMessageId, onDeanonymizeMessage])

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('')
    searchInputRef.current?.focus()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'f') {
          e.preventDefault()
          searchInputRef.current?.focus()
        } else if (e.key === 'a') {
          e.preventDefault()
          if (selectedMessages.size === processedMessages.length) {
            setSelectedMessages(new Set())
          } else {
            setSelectedMessages(new Set(processedMessages.map(m => m.id)))
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedMessages.size, processedMessages])

  // Stats calculation
  const stats = useMemo(() => {
    const totalResponseWords = processedMessages.reduce((sum, msg) => 
      sum + (msg.metadata?.wordCount || msg.response.split(' ').length), 0
    )
    const totalResponseChars = processedMessages.reduce((sum, msg) => 
      sum + (msg.metadata?.characterCount || msg.response.length), 0
    )
    const totalEntities = processedMessages.reduce((sum, msg) => 
      sum + (msg.anonymizationMetadata?.entitiesFound?.length || 0), 0
    )
    const uniqueSessions = new Set(processedMessages.map(msg => msg.sessionId)).size

    return { totalResponseWords, totalResponseChars, totalEntities, uniqueSessions }
  }, [processedMessages])

  if (messages.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
            <Bot className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <h3 className="font-medium mb-2">No LLM Responses Yet</h3>
            <p className="text-sm text-muted-foreground">
              {emptyStateMessage}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with search and controls */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5 text-green-500" />
            <h2 className="font-semibold">LLM Responses</h2>
            <Badge variant="secondary" className="text-xs">
              {processedMessages.length}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* View toggle */}
            <div className="flex items-center space-x-2 text-sm">
              <span>Show:</span>
              <div className="flex items-center space-x-1">
                <Switch
                  checked={showAnonymized}
                  onCheckedChange={setShowAnonymized}
                />
                <span className="text-xs">
                  {showAnonymized ? 'Anonymized' : 'Original'}
                </span>
                {showAnonymized ? 
                  <EyeOff className="h-3 w-3 text-muted-foreground" /> : 
                  <Eye className="h-3 w-3 text-muted-foreground" />
                }
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn("text-xs", showFilters && "bg-secondary")}
            >
              <Filter className="h-3 w-3 mr-1" />
              Filters
            </Button>
            
            {selectedMessages.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSelected}
                className="text-xs"
              >
                <Download className="h-3 w-3 mr-1" />
                Export ({selectedMessages.size})
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex items-center space-x-4 pt-2 border-t">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-sm border rounded px-2 py-1 bg-background"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="longest-response">Longest response</option>
                <option value="shortest-response">Shortest response</option>
                <option value="most-entities">Most PII entities</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Filter:</span>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="text-sm border rounded px-2 py-1 bg-background"
              >
                <option value="all">All responses</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="with-pii">With PII entities</option>
                <option value="deanonymized">Deanonymized</option>
              </select>
            </div>
          </div>
        )}

        {/* Stats */}
        {processedMessages.length > 0 && (
          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
            <span>{stats.totalResponseWords.toLocaleString()} words</span>
            <span>{stats.totalResponseChars.toLocaleString()} characters</span>
            <span>{stats.uniqueSessions} sessions</span>
            {stats.totalEntities > 0 && (
              <span className="text-orange-600">{stats.totalEntities} PII entities</span>
            )}
          </div>
        )}
      </div>

      {/* Messages list */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div className="p-4 space-y-4">
          {processedMessages.map((message) => {
            const isSelected = selectedMessages.has(message.id)
            const isExpanded = expandedMessageId === message.id
            const hasEntities = (message.anonymizationMetadata?.entitiesFound?.length || 0) > 0
            
            return (
              <Card
                key={message.id}
                className={cn(
                  "transition-colors",
                  isSelected && "ring-2 ring-green-500/50 bg-green-50/50"
                )}
              >
                {/* Message header */}
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Bot className="h-4 w-4 text-green-500" />
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {formatTimestamp(message.responseTimestamp)}
                          </span>
                          <span className="text-muted-foreground">
                            ({getRelativeTime(message.responseTimestamp)})
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          {message.metadata?.model && (
                            <Badge variant="outline" className="text-xs">
                              {message.metadata.model}
                            </Badge>
                          )}
                          {message.metadata?.responseTime && (
                            <span>{message.metadata.responseTime}ms</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {hasEntities && (
                        <Badge variant="outline" className="text-xs text-orange-600">
                          {message.anonymizationMetadata!.entitiesFound.length} PII
                        </Badge>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleMessageSelection(message.id)}
                        className={cn("h-6 w-6 p-0", isSelected && "bg-secondary")}
                      >
                        <CheckCircle className={cn("h-3 w-3", isSelected ? "text-green-500" : "text-muted-foreground")} />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Input context */}
                <div className="p-4 bg-muted/30 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Input Context ({showAnonymized ? 'anonymized' : 'original'})
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {hasEntities && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleExpanded(message)}
                          className="h-6 text-xs"
                        >
                          {isExpanded ? (
                            <>
                              <EyeOff className="h-3 w-3 mr-1" />
                              Hide Details
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3 mr-1" />
                              Show Details
                            </>
                          )}
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyMessage(message, 'input')}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-sm bg-background rounded-md p-3 border">
                    {showAnonymized ? message.anonymizedInput : message.originalInput}
                  </div>
                  
                  {/* Anonymization details */}
                  {isExpanded && hasEntities && showAnonymizationDetails && (
                    <div className="mt-3 space-y-2">
                      <Separator />
                      <div className="text-xs font-medium text-muted-foreground">
                        Anonymization Details
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {message.anonymizationMetadata!.entitiesFound.map((entity, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-background rounded p-2 border">
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary" className="text-xs">
                                {entity.type}
                              </Badge>
                              <span className="font-mono">{entity.original}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono text-orange-600">{entity.anonymized}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* LLM Response */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="h-3 w-3 text-green-500" />
                      <span className="text-sm font-medium">LLM Response</span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyMessage(message, 'response')}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="text-sm leading-relaxed mb-3">
                    {message.response}
                  </div>
                  
                  {/* Response metadata */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center space-x-3">
                      <span>{message.response.length} characters</span>
                      <span>{message.response.split(' ').length} words</span>
                      {message.metadata?.tokenCount && (
                        <span>{message.metadata.tokenCount} tokens</span>
                      )}
                    </div>
                    
                    <Badge variant="outline" className="text-xs">
                      Session: {message.sessionId.slice(-8)}
                    </Badge>
                  </div>
                </div>
              </Card>
            )
          })}

          {processedMessages.length === 0 && searchQuery && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No matching responses</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search terms or filters
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export default LLMView