"use client"

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  Shield, 
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Download,
  Eye,
  EyeOff,
  Key,
  FileText,
  Cpu,
  Lock,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { cn } from "@/lib/utils"

export type VerificationStatus = 'verified' | 'failed' | 'pending' | 'unknown'
export type AttestationStatus = 'valid' | 'invalid' | 'expired' | 'pending'

export interface TEEAttestationData {
  quote?: string
  signature?: string
  publicKey?: string
  signingMethod?: string
  attestationTime?: Date
  
  // Intel SGX specific
  mrenclave?: string
  mrsigner?: string
  isvprodid?: number
  isvsvn?: number
  reportData?: string
  
  // Certificate chain
  certificates?: Array<{
    subject: string
    issuer: string
    serialNumber: string
    validFrom: Date
    validTo: Date
    fingerprint: string
    isCA: boolean
  }>
  
  // Verification results
  quoteVerification?: {
    status: AttestationStatus
    message: string
    verifiedAt: Date
  }
  
  signatureVerification?: {
    status: VerificationStatus
    message: string
    verifiedAt: Date
  }
}

export interface VerificationRecord {
  id: string
  sessionId: string
  messageId?: string
  timestamp: Date
  
  // Content being verified
  originalContent: string
  anonymizedContent?: string
  
  // TEE attestation data
  attestation: TEEAttestationData
  
  // Overall verification status
  overallStatus: VerificationStatus
  
  // Metadata
  metadata?: {
    verificationMethod?: string
    clientVersion?: string
    serverVersion?: string
    processingTime?: number
  }
}

export interface VerificationViewProps {
  records: VerificationRecord[]
  onSelectRecord?: (record: VerificationRecord) => void
  onCopyData?: (data: string, type: 'quote' | 'signature' | 'publicKey' | 'content') => void
  onExportRecords?: (records: VerificationRecord[]) => void
  onRefreshVerification?: (record: VerificationRecord) => Promise<void>
  className?: string
  searchPlaceholder?: string
  emptyStateMessage?: string
}

type SortOption = 'newest' | 'oldest' | 'verified-first' | 'failed-first'
type FilterOption = 'all' | 'today' | 'week' | 'month' | 'verified' | 'failed' | 'pending'

const getStatusColor = (status: VerificationStatus | AttestationStatus) => {
  switch (status) {
    case 'verified':
    case 'valid':
      return 'text-green-600 bg-green-50 border-green-200'
    case 'failed':
    case 'invalid':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'pending':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'expired':
      return 'text-orange-600 bg-orange-50 border-orange-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

const getStatusIcon = (status: VerificationStatus | AttestationStatus) => {
  switch (status) {
    case 'verified':
    case 'valid':
      return <CheckCircle className="h-4 w-4" />
    case 'failed':
    case 'invalid':
    case 'expired':
      return <XCircle className="h-4 w-4" />
    case 'pending':
      return <RefreshCw className="h-4 w-4 animate-spin" />
    default:
      return <AlertTriangle className="h-4 w-4" />
  }
}

const formatTimestamp = (timestamp: Date): string => {
  return timestamp.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const truncateHex = (hex: string, length: number = 16): string => {
  if (!hex) return ''
  if (hex.length <= length * 2) return hex
  return `${hex.slice(0, length)}...${hex.slice(-length)}`
}

export function VerificationView({
  records,
  onSelectRecord,
  onCopyData,
  onExportRecords,
  onRefreshVerification,
  className = '',
  searchPlaceholder = "Search verification records...",
  emptyStateMessage = "No verification records yet. Messages will appear here when TEE attestation is enabled."
}: VerificationViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null)
  const [showSensitiveData, setShowSensitiveData] = useState(false)
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Filtered and sorted records
  const processedRecords = useMemo(() => {
    let filtered = records

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(record => 
        record.originalContent.toLowerCase().includes(query) ||
        record.sessionId.toLowerCase().includes(query) ||
        record.attestation.signingMethod?.toLowerCase().includes(query) ||
        record.overallStatus.toLowerCase().includes(query)
      )
    }

    // Apply date/status filters
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())

    filtered = filtered.filter(record => {
      switch (filterBy) {
        case 'today':
          return record.timestamp >= today
        case 'week':
          return record.timestamp >= weekAgo
        case 'month':
          return record.timestamp >= monthAgo
        case 'verified':
          return record.overallStatus === 'verified'
        case 'failed':
          return record.overallStatus === 'failed'
        case 'pending':
          return record.overallStatus === 'pending'
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
        case 'verified-first':
          if (a.overallStatus === 'verified' && b.overallStatus !== 'verified') return -1
          if (b.overallStatus === 'verified' && a.overallStatus !== 'verified') return 1
          return b.timestamp.getTime() - a.timestamp.getTime()
        case 'failed-first':
          if (a.overallStatus === 'failed' && b.overallStatus !== 'failed') return -1
          if (b.overallStatus === 'failed' && a.overallStatus !== 'failed') return 1
          return b.timestamp.getTime() - a.timestamp.getTime()
        default:
          return 0
      }
    })
  }, [records, searchQuery, sortBy, filterBy])

  // Handle record selection
  const toggleRecordSelection = useCallback((recordId: string) => {
    setSelectedRecords(prev => {
      const newSet = new Set(prev)
      if (newSet.has(recordId)) {
        newSet.delete(recordId)
      } else {
        newSet.add(recordId)
      }
      return newSet
    })
  }, [])

  // Handle copy data
  const handleCopyData = useCallback(async (data: string, type: 'quote' | 'signature' | 'publicKey' | 'content') => {
    try {
      await navigator.clipboard.writeText(data)
      onCopyData?.(data, type)
    } catch (error) {
      console.error('Failed to copy data:', error)
    }
  }, [onCopyData])

  // Handle export selected records
  const handleExportSelected = useCallback(() => {
    const selectedRecordData = records.filter(record => selectedRecords.has(record.id))
    onExportRecords?.(selectedRecordData)
  }, [records, selectedRecords, onExportRecords])

  // Handle record expansion
  const handleToggleExpanded = useCallback((recordId: string) => {
    setExpandedRecordId(prev => prev === recordId ? null : recordId)
  }, [])

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
          if (selectedRecords.size === processedRecords.length) {
            setSelectedRecords(new Set())
          } else {
            setSelectedRecords(new Set(processedRecords.map(r => r.id)))
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedRecords.size, processedRecords])

  // Stats calculation
  const stats = useMemo(() => {
    const verified = processedRecords.filter(r => r.overallStatus === 'verified').length
    const failed = processedRecords.filter(r => r.overallStatus === 'failed').length
    const pending = processedRecords.filter(r => r.overallStatus === 'pending').length
    const uniqueSessions = new Set(processedRecords.map(r => r.sessionId)).size

    return { verified, failed, pending, uniqueSessions }
  }, [processedRecords])

  if (records.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto">
            <Shield className="h-8 w-8 text-purple-500" />
          </div>
          <div>
            <h3 className="font-medium mb-2">No Verification Records</h3>
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
            <Shield className="h-5 w-5 text-purple-500" />
            <h2 className="font-semibold">TEE Verification</h2>
            <Badge variant="secondary" className="text-xs">
              {processedRecords.length}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 text-sm">
              <span>Show sensitive:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSensitiveData(!showSensitiveData)}
                className="h-6 text-xs"
              >
                {showSensitiveData ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
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
            
            {selectedRecords.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSelected}
                className="text-xs"
              >
                <Download className="h-3 w-3 mr-1" />
                Export ({selectedRecords.size})
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
                <option value="verified-first">Verified first</option>
                <option value="failed-first">Failed first</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Filter:</span>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="text-sm border rounded px-2 py-1 bg-background"
              >
                <option value="all">All records</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="verified">Verified only</option>
                <option value="failed">Failed only</option>
                <option value="pending">Pending only</option>
              </select>
            </div>
          </div>
        )}

        {/* Stats */}
        {processedRecords.length > 0 && (
          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
            <div className="flex items-center space-x-1">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span>{stats.verified} verified</span>
            </div>
            <div className="flex items-center space-x-1">
              <XCircle className="h-3 w-3 text-red-600" />
              <span>{stats.failed} failed</span>
            </div>
            {stats.pending > 0 && (
              <div className="flex items-center space-x-1">
                <RefreshCw className="h-3 w-3 text-yellow-600" />
                <span>{stats.pending} pending</span>
              </div>
            )}
            <span>{stats.uniqueSessions} sessions</span>
          </div>
        )}
      </div>

      {/* Records list */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div className="p-4 space-y-4">
          {processedRecords.map((record) => {
            const isSelected = selectedRecords.has(record.id)
            const isExpanded = expandedRecordId === record.id
            const statusColor = getStatusColor(record.overallStatus)
            
            return (
              <Card key={record.id} className={cn(
                "transition-colors",
                isSelected && "ring-2 ring-purple-500/50 bg-purple-50/50"
              )}>
                {/* Record header */}
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={cn("p-2 rounded-full", statusColor)}>
                        {getStatusIcon(record.overallStatus)}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className={cn("text-xs", statusColor)}>
                            {record.overallStatus.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium">
                            Verification Record
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(record.timestamp)}</span>
                          {record.metadata?.processingTime && (
                            <span>({record.metadata.processingTime}ms)</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {onRefreshVerification && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRefreshVerification(record)}
                          className="h-6 w-6 p-0"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleExpanded(record.id)}
                        className="h-6 w-6 p-0"
                      >
                        {isExpanded ? 
                          <ChevronUp className="h-3 w-3" /> : 
                          <ChevronDown className="h-3 w-3" />
                        }
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRecordSelection(record.id)}
                        className={cn("h-6 w-6 p-0", isSelected && "bg-secondary")}
                      >
                        <CheckCircle className={cn("h-3 w-3", isSelected ? "text-purple-500" : "text-muted-foreground")} />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Verification summary */}
                <div className="p-4 space-y-3">
                  {/* Quote verification */}
                  {record.attestation.quoteVerification && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Quote Verification</span>
                      </div>
                      <Badge variant="outline" className={cn("text-xs", getStatusColor(record.attestation.quoteVerification.status))}>
                        {record.attestation.quoteVerification.status}
                      </Badge>
                    </div>
                  )}
                  
                  {/* Signature verification */}
                  {record.attestation.signatureVerification && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Signature Verification</span>
                      </div>
                      <Badge variant="outline" className={cn("text-xs", getStatusColor(record.attestation.signatureVerification.status))}>
                        {record.attestation.signatureVerification.status}
                      </Badge>
                    </div>
                  )}
                  
                  {/* Session and content info */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Session: {record.sessionId.slice(-8)}</span>
                    <span>{record.originalContent.length} chars</span>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <>
                    <Separator />
                    <div className="p-4 space-y-6">
                      {/* Content being verified */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span>Verified Content</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyData(record.originalContent, 'content')}
                            className="h-5 w-5 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </h4>
                        <div className="text-sm bg-muted rounded-md p-3 font-mono text-xs max-h-32 overflow-y-auto">
                          {record.originalContent}
                        </div>
                      </div>

                      {/* TEE Quote */}
                      {record.attestation.quote && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center space-x-2">
                            <Shield className="h-4 w-4" />
                            <span>TEE Quote</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyData(record.attestation.quote!, 'quote')}
                              className="h-5 w-5 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </h4>
                          <div className="text-sm bg-muted rounded-md p-3 font-mono text-xs">
                            {showSensitiveData ? record.attestation.quote : truncateHex(record.attestation.quote)}
                          </div>
                        </div>
                      )}

                      {/* Signature */}
                      {record.attestation.signature && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center space-x-2">
                            <Lock className="h-4 w-4" />
                            <span>Signature ({record.attestation.signingMethod || 'Unknown'})</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyData(record.attestation.signature!, 'signature')}
                              className="h-5 w-5 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </h4>
                          <div className="text-sm bg-muted rounded-md p-3 font-mono text-xs">
                            {showSensitiveData ? record.attestation.signature : truncateHex(record.attestation.signature)}
                          </div>
                        </div>
                      )}

                      {/* Public Key */}
                      {record.attestation.publicKey && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center space-x-2">
                            <Key className="h-4 w-4" />
                            <span>Public Key</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyData(record.attestation.publicKey!, 'publicKey')}
                              className="h-5 w-5 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </h4>
                          <div className="text-sm bg-muted rounded-md p-3 font-mono text-xs">
                            {showSensitiveData ? record.attestation.publicKey : truncateHex(record.attestation.publicKey)}
                          </div>
                        </div>
                      )}

                      {/* SGX Measurements */}
                      {(record.attestation.mrenclave || record.attestation.mrsigner) && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center space-x-2">
                            <Cpu className="h-4 w-4" />
                            <span>SGX Measurements</span>
                          </h4>
                          <div className="space-y-2 text-xs">
                            {record.attestation.mrenclave && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">MRENCLAVE:</span>
                                <span className="font-mono">{truncateHex(record.attestation.mrenclave, 8)}</span>
                              </div>
                            )}
                            {record.attestation.mrsigner && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">MRSIGNER:</span>
                                <span className="font-mono">{truncateHex(record.attestation.mrsigner, 8)}</span>
                              </div>
                            )}
                            {record.attestation.isvprodid !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Product ID:</span>
                                <span>{record.attestation.isvprodid}</span>
                              </div>
                            )}
                            {record.attestation.isvsvn !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">SVN:</span>
                                <span>{record.attestation.isvsvn}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Certificate Chain */}
                      {record.attestation.certificates && record.attestation.certificates.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center space-x-2">
                            <FileText className="h-4 w-4" />
                            <span>Certificate Chain</span>
                          </h4>
                          <div className="space-y-2">
                            {record.attestation.certificates.map((cert, idx) => (
                              <div key={idx} className="text-xs border rounded p-2 space-y-1">
                                <div className="font-medium">{cert.subject}</div>
                                <div className="text-muted-foreground">Issued by: {cert.issuer}</div>
                                <div className="flex justify-between">
                                  <span>Valid: {cert.validFrom.toLocaleDateString()} - {cert.validTo.toLocaleDateString()}</span>
                                  <Badge variant={cert.isCA ? "secondary" : "outline"} className="text-xs">
                                    {cert.isCA ? "CA" : "End Entity"}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>
            )
          })}

          {processedRecords.length === 0 && searchQuery && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No matching records</h3>
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

export default VerificationView