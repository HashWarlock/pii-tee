"use client"

import { ThemeProvider } from "@/components/theme-provider"
import ErrorBoundary from "@/components/ui/error-boundary"
import { SkipToContent } from "@/components/ui/accessibility"

interface ClientProvidersProps {
  children: React.ReactNode
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <>
      <SkipToContent />
      <ErrorBoundary
        onError={(error, errorInfo) => {
          // In production, you would send this to your error reporting service
          console.error('Application error:', error, errorInfo)
        }}
        showErrorDetails={process.env.NODE_ENV === 'development'}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div id="main-content" className="min-h-screen">
            {children}
          </div>
        </ThemeProvider>
      </ErrorBoundary>
    </>
  )
}