import type { PropsWithChildren } from 'react'
import { cn } from '@/lib/cn'
import '../../assistant-ui.css'

export type AssistantUIThemeProviderProps = PropsWithChildren<{
  className?: string
}>

export function AssistantUIThemeProvider({ children, className }: AssistantUIThemeProviderProps) {
  return (
    <div
      className={cn('aui-theme h-full min-h-0 text-foreground', className)}
      data-slot='assistant-ui-theme'
    >
      {children}
    </div>
  )
}
