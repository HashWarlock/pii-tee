"use client"

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Search, 
  Filter,
  Clock,
  User,
  Copy,
  Download,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface HumanMessage {
  id: string
  content: string
  timestamp: Date
  sessionId?: string
  metadata?: {
    characterCount?: number
    wordCount?: number
    language?: string
    hasPersonalInfo?: boolean
  }
}

export interface HumanViewProps {
  messages: HumanMessage[]
  onSelectMessage?: (message: HumanMessage) => void
  onCopyMessage?: (message: HumanMessage) => void
  onExportMessages?: (messages: HumanMessage[]) => void
  className?: string
  searchPlaceholder?: string
  emptyStateMessage?: string
}

type SortOption = 'newest' | 'oldest' | 'longest' | 'shortest'
type FilterOption = 'all' | 'today' | 'week' | 'month' | 'with-pii'

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

export function HumanView({
  messages,
  onSelectMessage,
  onCopyMessage,
  onExportMessages,
  className = '',
  searchPlaceholder = "Search your messages...",
  emptyStateMessage = "No messages yet. Start a conversation to see your messages here."
}: HumanViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Filtered and sorted messages
  const processedMessages = useMemo(() => {
    let filtered = messages

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(message => 
        message.content.toLowerCase().includes(query) ||
        message.sessionId?.toLowerCase().includes(query)
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
          return message.timestamp >= today
        case 'week':
          return message.timestamp >= weekAgo
        case 'month':
          return message.timestamp >= monthAgo
        case 'with-pii':
          return message.metadata?.hasPersonalInfo === true
        default:
          return true
      }
    })

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.timestamp.getTime() - a.timestamp.getTime()
        case 'oldest':
          return a.timestamp.getTime() - b.timestamp.getTime()
        case 'longest':
          return b.content.length - a.content.length
        case 'shortest':
          return a.content.length - b.content.length
        default:
          return 0
      }
    })
  }, [messages, searchQuery, sortBy, filterBy])

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
  const handleCopyMessage = useCallback(async (message: HumanMessage) => {
    try {
      await navigator.clipboard.writeText(message.content)
      onCopyMessage?.(message)
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }, [onCopyMessage])

  // Handle export selected messages
  const handleExportSelected = useCallback(() => {
    const selectedMessageData = messages.filter(msg => selectedMessages.has(msg.id))
    onExportMessages?.(selectedMessageData)
  }, [messages, selectedMessages, onExportMessages])

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
    const totalWords = processedMessages.reduce((sum, msg) => 
      sum + (msg.metadata?.wordCount || msg.content.split(' ').length), 0
    )
    const totalChars = processedMessages.reduce((sum, msg) => 
      sum + (msg.metadata?.characterCount || msg.content.length), 0
    )
    const withPII = processedMessages.filter(msg => msg.metadata?.hasPersonalInfo).length

    return { totalWords, totalChars, withPII }
  }, [processedMessages])

  if (messages.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
            <User className="h-8 w-8 text-blue-500" />
          </div>
          <div>
            <h3 className="font-medium mb-2">No Messages Yet</h3>
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
            <User className="h-5 w-5 text-blue-500" />
            <h2 className="font-semibold">Your Messages</h2>
            <Badge variant="secondary" className="text-xs">
              {processedMessages.length}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
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
                <option value="longest">Longest first</option>
                <option value="shortest">Shortest first</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Filter:</span>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="text-sm border rounded px-2 py-1 bg-background"
              >
                <option value="all">All messages</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="with-pii">With personal info</option>
              </select>
            </div>
          </div>
        )}

        {/* Stats */}
        {processedMessages.length > 0 && (
          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
            <span>{stats.totalWords.toLocaleString()} words</span>
            <span>{stats.totalChars.toLocaleString()} characters</span>
            {stats.withPII > 0 && (
              <span className="text-orange-600">{stats.withPII} with PII</span>
            )}
          </div>
        )}
      </div>

      {/* Messages list */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div className="p-4 space-y-3">
          {processedMessages.map((message) => (
            <Card
              key={message.id}
              className={cn(
                "p-4 cursor-pointer transition-colors hover:bg-muted/50",
                selectedMessages.has(message.id) && "ring-2 ring-blue-500/50 bg-blue-50/50"
              )}
              onClick={() => {
                onSelectMessage?.(message)
                toggleMessageSelection(message.id)
              }}
            >
              <div className="space-y-3">
                {/* Message header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(message.timestamp)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({getRelativeTime(message.timestamp)})
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {message.metadata?.hasPersonalInfo && (
                      <Badge variant="outline" className="text-xs text-orange-600">
                        PII
                      </Badge>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopyMessage(message)
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Message content */}
                <div className="space-y-2">
                  <div className="text-sm leading-relaxed">
                    {message.content}
                  </div>
                  
                  {/* Message metadata */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center space-x-3">
                      <span>{message.content.length} characters</span>
                      <span>{message.content.split(' ').length} words</span>
                      {message.metadata?.language && (
                        <span>{message.metadata.language.toUpperCase()}</span>
                      )}
                    </div>
                    
                    {message.sessionId && (
                      <Badge variant="outline" className="text-xs">
                        Session: {message.sessionId.slice(-8)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {processedMessages.length === 0 && searchQuery && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No matching messages</h3>
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

export default HumanView