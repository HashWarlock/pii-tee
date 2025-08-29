"use client"

import React from 'react'
import { cn } from '@/lib/utils'

interface ResponsiveContainerProps {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  padding?: boolean
}

export function ResponsiveContainer({ 
  children, 
  className, 
  size = 'xl',
  padding = true 
}: ResponsiveContainerProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-7xl',
    full: 'max-w-none'
  }

  return (
    <div className={cn(
      "mx-auto w-full",
      sizeClasses[size],
      padding && "px-4 sm:px-6 lg:px-8",
      className
    )}>
      {children}
    </div>
  )
}

// Responsive grid component
interface ResponsiveGridProps {
  children: React.ReactNode
  className?: string
  cols?: {
    default?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: 'sm' | 'md' | 'lg'
}

export function ResponsiveGrid({ 
  children, 
  className,
  cols = { default: 1, md: 2, lg: 3 },
  gap = 'md'
}: ResponsiveGridProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  }

  const getGridColsClass = () => {
    const classes = ['grid']
    
    if (cols.default) classes.push(`grid-cols-${cols.default}`)
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`)
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`)
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`)
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`)
    
    return classes.join(' ')
  }

  return (
    <div className={cn(
      getGridColsClass(),
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  )
}

// Responsive stack component
interface ResponsiveStackProps {
  children: React.ReactNode
  className?: string
  direction?: {
    default?: 'row' | 'col'
    sm?: 'row' | 'col'
    md?: 'row' | 'col'
    lg?: 'row' | 'col'
  }
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
  gap?: 'sm' | 'md' | 'lg'
}

export function ResponsiveStack({ 
  children, 
  className,
  direction = { default: 'col', md: 'row' },
  align = 'start',
  justify = 'start',
  gap = 'md'
}: ResponsiveStackProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  }

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  }

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around'
  }

  const getDirectionClass = () => {
    const classes = ['flex']
    
    if (direction.default) classes.push(direction.default === 'row' ? 'flex-row' : 'flex-col')
    if (direction.sm) classes.push(direction.sm === 'row' ? 'sm:flex-row' : 'sm:flex-col')
    if (direction.md) classes.push(direction.md === 'row' ? 'md:flex-row' : 'md:flex-col')
    if (direction.lg) classes.push(direction.lg === 'row' ? 'lg:flex-row' : 'lg:flex-col')
    
    return classes.join(' ')
  }

  return (
    <div className={cn(
      getDirectionClass(),
      alignClasses[align],
      justifyClasses[justify],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  )
}

// Responsive card component
interface ResponsiveCardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
  hover?: boolean
}

export function ResponsiveCard({ 
  children, 
  className,
  padding = 'md',
  hover = false
}: ResponsiveCardProps) {
  const paddingClasses = {
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8'
  }

  return (
    <div className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-200",
      paddingClasses[padding],
      hover && "hover:shadow-md hover:-translate-y-0.5",
      className
    )}>
      {children}
    </div>
  )
}

export default ResponsiveContainer