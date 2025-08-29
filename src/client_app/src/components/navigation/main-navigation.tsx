"use client"

import React, { useState, useCallback, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  User, 
  Bot, 
  Shield, 
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Eye,
  EyeOff
} from "lucide-react"
import { cn } from "@/lib/utils"

export type NavigationView = 'human' | 'llm' | 'verification'

export interface NavigationStats {
  humanMessages: number
  llmMessages: number
  verificationsPending: number
  verificationsComplete: number
}

export interface MainNavigationProps {
  activeView: NavigationView
  onViewChange: (view: NavigationView) => void
  stats?: NavigationStats
  className?: string
  isMobile?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
  showViewToggle?: boolean
  onViewModeToggle?: (mode: 'original' | 'anonymized') => void
  currentViewMode?: 'original' | 'anonymized'
}

const navigationConfig = {
  human: {
    id: 'human',
    label: 'Human View',
    icon: User,
    description: 'Your original messages',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    shortLabel: 'Human'
  },
  llm: {
    id: 'llm',
    label: 'LLM View', 
    icon: Bot,
    description: 'AI responses and context',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    shortLabel: 'AI'
  },
  verification: {
    id: 'verification',
    label: 'Verification',
    icon: Shield,
    description: 'TEE attestation and signatures',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    shortLabel: 'Verify'
  }
} as const

export function MainNavigation({
  activeView,
  onViewChange,
  stats,
  className = '',
  isMobile = false,
  collapsed = false,
  onToggleCollapsed,
  showViewToggle = true,
  onViewModeToggle,
  currentViewMode = 'original'
}: MainNavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      
      const views: NavigationView[] = ['human', 'llm', 'verification']
      const currentIndex = views.indexOf(activeView)
      let nextIndex: number
      
      if (event.key === 'ArrowLeft') {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : views.length - 1
      } else {
        nextIndex = currentIndex < views.length - 1 ? currentIndex + 1 : 0
      }
      
      onViewChange(views[nextIndex])
    }
  }, [activeView, onViewChange])

  // Close mobile menu when view changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [activeView])

  // Mobile menu toggle
  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev)
  }, [])

  // Desktop sidebar version
  if (!isMobile && collapsed !== undefined) {
    return (
      <div className={cn(
        "border-r bg-background transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        className
      )}>
        <div className="p-4">
          {/* Collapse toggle */}
          <div className="flex justify-end mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapsed}
              className="h-8 w-8 p-0"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Navigation items */}
          <nav className="space-y-2" role="navigation" aria-label="Main navigation">
            {Object.entries(navigationConfig).map(([key, config]) => {
              const view = key as NavigationView
              const Icon = config.icon
              const isActive = activeView === view
              const messageCount = view === 'human' ? stats?.humanMessages : 
                                 view === 'llm' ? stats?.llmMessages :
                                 (stats?.verificationsPending || 0) + (stats?.verificationsComplete || 0)

              return (
                <Button
                  key={view}
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start transition-colors",
                    collapsed ? "px-3" : "px-4",
                    isActive && config.bgColor
                  )}
                  onClick={() => onViewChange(view)}
                  aria-pressed={isActive}
                  aria-describedby={`nav-${view}-desc`}
                >
                  <Icon className={cn("h-4 w-4", config.color, collapsed ? "" : "mr-3")} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{config.label}</span>
                      {messageCount !== undefined && messageCount > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {messageCount}
                        </Badge>
                      )}
                    </>
                  )}
                </Button>
              )
            })}
          </nav>

          {/* View mode toggle (when not collapsed) */}
          {!collapsed && showViewToggle && onViewModeToggle && (
            <div className="mt-6 pt-4 border-t">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                View Mode
              </div>
              <div className="flex space-x-1">
                <Button
                  variant={currentViewMode === 'original' ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onViewModeToggle('original')}
                  className="flex-1 text-xs"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Original
                </Button>
                <Button
                  variant={currentViewMode === 'anonymized' ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onViewModeToggle('anonymized')}
                  className="flex-1 text-xs"
                >
                  <EyeOff className="h-3 w-3 mr-1" />
                  Anonymous
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden descriptions for screen readers */}
        {Object.entries(navigationConfig).map(([key, config]) => (
          <div key={key} id={`nav-${key}-desc`} className="sr-only">
            {config.description}
          </div>
        ))}
      </div>
    )
  }

  // Mobile version with hamburger menu
  if (isMobile) {
    return (
      <>
        {/* Mobile header with hamburger */}
        <div className={cn("border-b bg-background p-4", className)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMobileMenu}
                className="h-8 w-8 p-0"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
              
              <div className="flex items-center space-x-2">
                {(() => {
                  const config = navigationConfig[activeView]
                  const Icon = config.icon
                  return (
                    <>
                      <Icon className={cn("h-5 w-5", config.color)} />
                      <span className="font-medium">{config.label}</span>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* View mode toggle for mobile */}
            {showViewToggle && onViewModeToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewModeToggle(currentViewMode === 'original' ? 'anonymized' : 'original')}
                className="h-8 text-xs"
              >
                {currentViewMode === 'original' ? (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    Original
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3 w-3 mr-1" />
                    Anonymous
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile slide-out menu */}
        {mobileMenuOpen && (
          <div className="absolute inset-0 z-50">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50"
              onClick={toggleMobileMenu}
            />
            
            {/* Menu panel */}
            <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[80vw] bg-background border-r shadow-lg">
              <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-semibold">Navigation</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMobileMenu}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <nav className="space-y-2">
                  {Object.entries(navigationConfig).map(([key, config]) => {
                    const view = key as NavigationView
                    const Icon = config.icon
                    const isActive = activeView === view
                    const messageCount = view === 'human' ? stats?.humanMessages : 
                                       view === 'llm' ? stats?.llmMessages :
                                       (stats?.verificationsPending || 0) + (stats?.verificationsComplete || 0)

                    return (
                      <Button
                        key={view}
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start",
                          isActive && config.bgColor
                        )}
                        onClick={() => onViewChange(view)}
                      >
                        <Icon className={cn("h-4 w-4 mr-3", config.color)} />
                        <div className="flex-1 text-left">
                          <div>{config.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {config.description}
                          </div>
                        </div>
                        {messageCount !== undefined && messageCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {messageCount}
                          </Badge>
                        )}
                      </Button>
                    )
                  })}
                </nav>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // Default tab version for desktop
  return (
    <div className={cn("border-b", className)}>
      <Tabs 
        value={activeView} 
        onValueChange={(value) => onViewChange(value as NavigationView)}
        className="w-full"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between px-4 py-2">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            {Object.entries(navigationConfig).map(([key, config]) => {
              const view = key as NavigationView
              const Icon = config.icon
              const messageCount = view === 'human' ? stats?.humanMessages : 
                                 view === 'llm' ? stats?.llmMessages :
                                 (stats?.verificationsPending || 0) + (stats?.verificationsComplete || 0)

              return (
                <TabsTrigger
                  key={view}
                  value={view}
                  className="flex items-center space-x-2"
                  aria-describedby={`tab-${view}-desc`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{config.shortLabel}</span>
                  {messageCount !== undefined && messageCount > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {messageCount}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {/* View mode toggle */}
          {showViewToggle && onViewModeToggle && (
            <div className="flex items-center space-x-1">
              <Button
                variant={currentViewMode === 'original' ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onViewModeToggle('original')}
                className="text-xs"
              >
                <Eye className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Original</span>
              </Button>
              <Button
                variant={currentViewMode === 'anonymized' ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onViewModeToggle('anonymized')}
                className="text-xs"
              >
                <EyeOff className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Anonymous</span>
              </Button>
            </div>
          )}
        </div>
      </Tabs>

      {/* Hidden descriptions for screen readers */}
      {Object.entries(navigationConfig).map(([key, config]) => (
        <div key={key} id={`tab-${key}-desc`} className="sr-only">
          {config.description}
        </div>
      ))}
    </div>
  )
}

export default MainNavigation