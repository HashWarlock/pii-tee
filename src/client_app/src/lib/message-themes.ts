import React from "react"
import { Bot, User, Shield, Sparkles, MessageCircle, Zap } from "lucide-react"

export interface MessageTheme {
  name: string
  human: {
    background: string
    text: string
    border?: string
    gradient?: string
    avatar: {
      background: string
      icon: React.ComponentType<{ className?: string }>
      iconColor: string
    }
    alignment: 'left' | 'right'
  }
  llm: {
    background: string
    text: string
    border?: string
    gradient?: string
    avatar: {
      background: string
      icon: React.ComponentType<{ className?: string }>
      iconColor: string
    }
    alignment: 'left' | 'right'
  }
}

export const messageThemes: Record<string, MessageTheme> = {
  default: {
    name: "Default",
    human: {
      background: "bg-primary",
      text: "text-primary-foreground",
      gradient: "bg-gradient-to-br from-primary to-primary/80",
      avatar: {
        background: "bg-gradient-to-r from-green-500 to-teal-600",
        icon: User,
        iconColor: "text-white"
      },
      alignment: 'right'
    },
    llm: {
      background: "bg-muted",
      text: "text-foreground",
      border: "border-border",
      avatar: {
        background: "bg-gradient-to-r from-blue-500 to-purple-600",
        icon: Bot,
        iconColor: "text-white"
      },
      alignment: 'left'
    }
  },

  modern: {
    name: "Modern",
    human: {
      background: "bg-slate-900 dark:bg-slate-100",
      text: "text-slate-100 dark:text-slate-900",
      gradient: "bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-200",
      avatar: {
        background: "bg-gradient-to-r from-emerald-500 to-cyan-500",
        icon: MessageCircle,
        iconColor: "text-white"
      },
      alignment: 'right'
    },
    llm: {
      background: "bg-slate-50 dark:bg-slate-800",
      text: "text-slate-900 dark:text-slate-100",
      border: "border-slate-200 dark:border-slate-700",
      avatar: {
        background: "bg-gradient-to-r from-violet-500 to-purple-500",
        icon: Sparkles,
        iconColor: "text-white"
      },
      alignment: 'left'
    }
  },

  secure: {
    name: "Secure",
    human: {
      background: "bg-green-600 dark:bg-green-700",
      text: "text-white",
      gradient: "bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-700",
      avatar: {
        background: "bg-gradient-to-r from-green-500 to-emerald-500",
        icon: Shield,
        iconColor: "text-white"
      },
      alignment: 'right'
    },
    llm: {
      background: "bg-blue-50 dark:bg-blue-950",
      text: "text-blue-900 dark:text-blue-100",
      border: "border-blue-200 dark:border-blue-800",
      avatar: {
        background: "bg-gradient-to-r from-blue-500 to-indigo-500",
        icon: Zap,
        iconColor: "text-white"
      },
      alignment: 'left'
    }
  },

  minimal: {
    name: "Minimal",
    human: {
      background: "bg-transparent",
      text: "text-foreground",
      border: "border-r-4 border-r-primary",
      avatar: {
        background: "bg-primary/10",
        icon: User,
        iconColor: "text-primary"
      },
      alignment: 'right'
    },
    llm: {
      background: "bg-transparent",
      text: "text-foreground",
      border: "border-l-4 border-l-muted-foreground",
      avatar: {
        background: "bg-muted-foreground/10",
        icon: Bot,
        iconColor: "text-muted-foreground"
      },
      alignment: 'left'
    }
  }
}

export const getMessageTheme = (themeName: string = 'default'): MessageTheme => {
  return messageThemes[themeName] || messageThemes.default
}

// Accessibility helpers
export const getContrastRatio = (bg: string, text: string): number => {
  // Simplified contrast ratio calculation
  // In real implementation, you'd use a proper color contrast library
  const bgLuminance = bg.includes('dark') ? 0.1 : 0.9
  const textLuminance = text.includes('white') ? 1.0 : 0.0
  
  const lighter = Math.max(bgLuminance, textLuminance)
  const darker = Math.min(bgLuminance, textLuminance)
  
  return (lighter + 0.05) / (darker + 0.05)
}

export const isAccessible = (theme: MessageTheme): boolean => {
  const humanContrast = getContrastRatio(theme.human.background, theme.human.text)
  const llmContrast = getContrastRatio(theme.llm.background, theme.llm.text)
  
  // WCAG AA standard requires 4.5:1 for normal text
  return humanContrast >= 4.5 && llmContrast >= 4.5
}