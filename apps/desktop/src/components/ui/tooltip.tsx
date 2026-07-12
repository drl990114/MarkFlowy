import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function TooltipProvider(props: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider {...props} />
}

export function TooltipRoot(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props} />
}

export function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot='tooltip-trigger' {...props} />
}

export type TooltipContentProps = ComponentProps<typeof TooltipPrimitive.Content> & {
  container?: ComponentProps<typeof TooltipPrimitive.Portal>['container']
}

export function TooltipContent({
  className,
  container,
  sideOffset = 5,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content
        className={cn(
          'z-[1001] rounded-md border border-border bg-tooltip px-2 py-1 text-xs text-foreground shadow-sm',
          className,
        )}
        data-mf-portal=''
        data-slot='tooltip-content'
        sideOffset={sideOffset}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

export const Tooltip = Object.assign(TooltipRoot, {
  Root: TooltipRoot,
  Provider: TooltipProvider,
  Trigger: TooltipTrigger,
  Content: TooltipContent,
})
