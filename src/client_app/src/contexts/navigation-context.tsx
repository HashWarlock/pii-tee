"use client"

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'

export type NavigationView = 'human' | 'llm' | 'verification'
export type ViewMode = 'original' | 'anonymized'

export interface NavigationStats {
  humanMessages: number
  llmMessages: number
  verificationsPending: number
  verificationsComplete: number
}

export interface NavigationState {
  activeView: NavigationView
  viewMode: ViewMode
  stats: NavigationStats
  isMobileMenuOpen: boolean
  isSidebarCollapsed: boolean
}

export interface NavigationContextValue extends NavigationState {
  // View navigation
  setActiveView: (view: NavigationView) => void
  setViewMode: (mode: ViewMode) => void
  toggleViewMode: () => void
  
  // Stats management
  updateStats: (stats: Partial<NavigationStats>) => void
  incrementStat: (stat: keyof NavigationStats) => void
  
  // UI state
  setMobileMenuOpen: (open: boolean) => void
  toggleMobileMenu: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  
  // Navigation helpers
  navigateNext: () => void
  navigatePrevious: () => void
  canNavigateNext: boolean
  canNavigatePrevious: boolean
  
  // Persistence
  resetNavigation: () => void
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined)

const NAVIGATION_STORAGE_KEY = 'pii-tee-navigation'

const initialStats: NavigationStats = {
  humanMessages: 0,
  llmMessages: 0,
  verificationsPending: 0,
  verificationsComplete: 0
}

const initialState: NavigationState = {
  activeView: 'human',
  viewMode: 'original',
  stats: initialStats,
  isMobileMenuOpen: false,
  isSidebarCollapsed: false
}

export interface NavigationProviderProps {
  children: React.ReactNode
  defaultView?: NavigationView
  defaultViewMode?: ViewMode
  persistState?: boolean
}

export function NavigationProvider({
  children,
  defaultView = 'human',
  defaultViewMode = 'original',
  persistState = true
}: NavigationProviderProps) {
  const [state, setState] = useState<NavigationState>(() => {
    if (!persistState) {
      return {
        ...initialState,
        activeView: defaultView,
        viewMode: defaultViewMode
      }
    }

    // Try to load persisted state
    try {
      const stored = localStorage.getItem(NAVIGATION_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          ...initialState,
          ...parsed,
          // Don't persist UI state
          isMobileMenuOpen: false,
          isSidebarCollapsed: parsed.isSidebarCollapsed ?? false
        }
      }
    } catch (error) {
      console.warn('Failed to load navigation state:', error)
    }

    return {
      ...initialState,
      activeView: defaultView,
      viewMode: defaultViewMode
    }
  })

  // Persist state when it changes
  useEffect(() => {
    if (persistState) {
      try {
        const stateToPersist = {
          activeView: state.activeView,
          viewMode: state.viewMode,
          stats: state.stats,
          isSidebarCollapsed: state.isSidebarCollapsed
        }
        localStorage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify(stateToPersist))
      } catch (error) {
        console.warn('Failed to persist navigation state:', error)
      }
    }
  }, [state, persistState])

  // View navigation
  const setActiveView = useCallback((view: NavigationView) => {
    setState(prev => ({ ...prev, activeView: view, isMobileMenuOpen: false }))
  }, [])

  const setViewMode = useCallback((mode: ViewMode) => {
    setState(prev => ({ ...prev, viewMode: mode }))
  }, [])

  const toggleViewMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      viewMode: prev.viewMode === 'original' ? 'anonymized' : 'original'
    }))
  }, [])

  // Stats management
  const updateStats = useCallback((newStats: Partial<NavigationStats>) => {
    setState(prev => ({
      ...prev,
      stats: { ...prev.stats, ...newStats }
    }))
  }, [])

  const incrementStat = useCallback((stat: keyof NavigationStats) => {
    setState(prev => ({
      ...prev,
      stats: { ...prev.stats, [stat]: prev.stats[stat] + 1 }
    }))
  }, [])

  // UI state management
  const setMobileMenuOpen = useCallback((open: boolean) => {
    setState(prev => ({ ...prev, isMobileMenuOpen: open }))
  }, [])

  const toggleMobileMenu = useCallback(() => {
    setState(prev => ({ ...prev, isMobileMenuOpen: !prev.isMobileMenuOpen }))
  }, [])

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setState(prev => ({ ...prev, isSidebarCollapsed: collapsed }))
  }, [])

  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, isSidebarCollapsed: !prev.isSidebarCollapsed }))
  }, [])

  // Navigation helpers
  const views = useMemo<NavigationView[]>(() => ['human', 'llm', 'verification'], [])
  const currentIndex = views.indexOf(state.activeView)
  
  const canNavigateNext = currentIndex < views.length - 1
  const canNavigatePrevious = currentIndex > 0

  const navigateNext = useCallback(() => {
    if (canNavigateNext) {
      setActiveView(views[currentIndex + 1])
    }
  }, [canNavigateNext, currentIndex, views, setActiveView])

  const navigatePrevious = useCallback(() => {
    if (canNavigatePrevious) {
      setActiveView(views[currentIndex - 1])
    }
  }, [canNavigatePrevious, currentIndex, views, setActiveView])

  // Reset navigation
  const resetNavigation = useCallback(() => {
    setState({
      ...initialState,
      activeView: defaultView,
      viewMode: defaultViewMode
    })
  }, [defaultView, defaultViewMode])

  const contextValue: NavigationContextValue = {
    // State
    ...state,
    
    // View navigation
    setActiveView,
    setViewMode,
    toggleViewMode,
    
    // Stats management
    updateStats,
    incrementStat,
    
    // UI state
    setMobileMenuOpen,
    toggleMobileMenu,
    setSidebarCollapsed,
    toggleSidebar,
    
    // Navigation helpers
    navigateNext,
    navigatePrevious,
    canNavigateNext,
    canNavigatePrevious,
    
    // Persistence
    resetNavigation
  }

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext)
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}

// Convenience hooks for specific functionality
export function useNavigationView(): {
  activeView: NavigationView
  setActiveView: (view: NavigationView) => void
  navigateNext: () => void
  navigatePrevious: () => void
  canNavigateNext: boolean
  canNavigatePrevious: boolean
} {
  const { activeView, setActiveView, navigateNext, navigatePrevious, canNavigateNext, canNavigatePrevious } = useNavigation()
  return { activeView, setActiveView, navigateNext, navigatePrevious, canNavigateNext, canNavigatePrevious }
}

export function useViewMode(): {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  toggleViewMode: () => void
} {
  const { viewMode, setViewMode, toggleViewMode } = useNavigation()
  return { viewMode, setViewMode, toggleViewMode }
}

export function useNavigationStats(): {
  stats: NavigationStats
  updateStats: (stats: Partial<NavigationStats>) => void
  incrementStat: (stat: keyof NavigationStats) => void
} {
  const { stats, updateStats, incrementStat } = useNavigation()
  return { stats, updateStats, incrementStat }
}

export default NavigationProvider