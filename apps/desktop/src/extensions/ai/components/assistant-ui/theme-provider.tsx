import type { PropsWithChildren } from 'react'
import { cn } from '@/lib/cn'
import { TooltipProvider } from '@/components/ui/tooltip'
import '../../assistant-ui.css'

export type AssistantUIThemeProviderProps = PropsWithChildren<{
  className?: string
}>

export function AssistantUIThemeProvider({ children, className }: AssistantUIThemeProviderProps) {
  return (
    <TooltipProvider delayDuration={350}>
      <div
        className={cn('aui-theme h-full min-h-0 text-foreground', className)}
        data-slot='assistant-ui-theme'
      >
        {children}
      </div>
    </TooltipProvider>
  )
}
