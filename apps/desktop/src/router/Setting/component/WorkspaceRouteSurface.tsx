import { cn } from '@/lib/cn'
import type { PropsWithChildren } from 'react'

interface WorkspaceRouteSurfaceProps extends PropsWithChildren {
  inactive: boolean
}

export function WorkspaceRouteSurface({ children, inactive }: WorkspaceRouteSurfaceProps) {
  return (
    <div
      aria-hidden={inactive || undefined}
      className={cn(
        'absolute inset-0 isolate min-h-0 min-w-0 overflow-hidden',
        inactive && 'invisible pointer-events-none',
      )}
      data-mf-workspace-surface=''
      inert={inactive || undefined}
    >
      {children}
    </div>
  )
}
