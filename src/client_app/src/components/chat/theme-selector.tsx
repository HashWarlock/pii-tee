// import { useState } from "react" // TODO: Future expandable theme selector
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { messageThemes, getMessageTheme, isAccessible } from "@/lib/message-themes"
import { Palette, Check, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ThemeSelectorProps {
  currentTheme: string
  onThemeChange: (theme: string) => void
  showPreview?: boolean
  className?: string
}

export function ThemeSelector({ 
  currentTheme, 
  onThemeChange, 
  showPreview = true,
  className 
}: ThemeSelectorProps) {
  // const [isOpen, setIsOpen] = useState(false) // TODO: Future expandable theme selector

  const renderThemePreview = (themeName: string) => {
    const theme = getMessageTheme(themeName)
    const HumanIcon = theme.human.avatar.icon
    const LLMIcon = theme.llm.avatar.icon
    const accessible = isAccessible(theme)

    return (
      <Card className="p-3 space-y-2 w-full">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">{theme.name}</span>
          {accessible ? (
            <Badge variant="outline" className="text-xs text-green-600">
              <Check className="h-3 w-3 mr-1" />
              Accessible
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Low Contrast
            </Badge>
          )}
        </div>
        
        <div className="space-y-2">
          {/* Human message preview */}
          <div className={cn(
            "flex",
            theme.human.alignment === 'right' ? 'justify-end' : 'justify-start'
          )}>
            <div className="flex items-center gap-2 max-w-[80%]">
              {theme.human.alignment === 'left' && (
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  theme.human.avatar.background
                )}>
                  <HumanIcon className={cn("h-3 w-3", theme.human.avatar.iconColor)} />
                </div>
              )}
              
              <div className={cn(
                "px-3 py-2 rounded-lg text-xs",
                theme.human.gradient || theme.human.background,
                theme.human.text,
                theme.human.border
              )}>
                Hello! This is a preview.
              </div>
              
              {theme.human.alignment === 'right' && (
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  theme.human.avatar.background
                )}>
                  <HumanIcon className={cn("h-3 w-3", theme.human.avatar.iconColor)} />
                </div>
              )}
            </div>
          </div>
          
          {/* LLM message preview */}
          <div className={cn(
            "flex",
            theme.llm.alignment === 'right' ? 'justify-end' : 'justify-start'
          )}>
            <div className="flex items-center gap-2 max-w-[80%]">
              {theme.llm.alignment === 'left' && (
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  theme.llm.avatar.background
                )}>
                  <LLMIcon className={cn("h-3 w-3", theme.llm.avatar.iconColor)} />
                </div>
              )}
              
              <div className={cn(
                "px-3 py-2 rounded-lg text-xs",
                theme.llm.gradient || theme.llm.background,
                theme.llm.text,
                theme.llm.border
              )}>
                Hi there! I&apos;m the AI assistant.
              </div>
              
              {theme.llm.alignment === 'right' && (
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  theme.llm.avatar.background
                )}>
                  <LLMIcon className={cn("h-3 w-3", theme.llm.avatar.iconColor)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <Select value={currentTheme} onValueChange={onThemeChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(messageThemes).map(([key, theme]) => {
              const accessible = isAccessible(theme)
              return (
                <SelectItem key={key} value={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{theme.name}</span>
                    {currentTheme === key && (
                      <Check className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  {!accessible && (
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  )}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {showPreview && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Preview</h4>
          {renderThemePreview(currentTheme)}
        </div>
      )}
      
      <div className="text-xs text-muted-foreground">
        <p>Choose a theme that provides clear visual distinction between your messages and AI responses.</p>
        {!isAccessible(getMessageTheme(currentTheme)) && (
          <p className="text-amber-600 flex items-center gap-1 mt-1">
            <AlertTriangle className="h-3 w-3" />
            Current theme may have accessibility issues.
          </p>
        )}
      </div>
    </div>
  )
}

// Quick theme preset buttons
export function ThemePresets({ 
  onThemeChange, 
  currentTheme,
  className 
}: { 
  onThemeChange: (theme: string) => void
  currentTheme: string
  className?: string 
}) {
  const popularThemes = ['default', 'modern', 'secure', 'minimal']

  return (
    <div className={cn("flex gap-2 flex-wrap", className)}>
      {popularThemes.map((themeKey) => {
        const theme = messageThemes[themeKey]
        const isSelected = currentTheme === themeKey
        const accessible = isAccessible(theme)
        
        return (
          <Button
            key={themeKey}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onThemeChange(themeKey)}
            className="text-xs"
          >
            {theme.name}
            {isSelected && <Check className="h-3 w-3 ml-1" />}
            {!accessible && <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />}
          </Button>
        )
      })}
    </div>
  )
}