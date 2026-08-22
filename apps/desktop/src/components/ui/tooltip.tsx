import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function TooltipProvider({
  delayDuration = 350,
  skipDelayDuration = 80,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  )
}

export function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
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
          'z-[var(--mf-layer-tooltip)] rounded-md border border-control-border bg-surface-tooltip px-2 py-1 text-ui-caption tracking-[var(--mf-ui-tracking-caption)] text-content-primary shadow-sm',
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
