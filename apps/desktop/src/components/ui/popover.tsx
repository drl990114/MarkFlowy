import { Popover as PopoverPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function PopoverRoot(props: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root {...props} />
}

export function PopoverAnchor(props: ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot='popover-anchor' {...props} />
}

export function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot='popover-trigger' {...props} />
}

export function PopoverClose(props: ComponentProps<typeof PopoverPrimitive.Close>) {
  return <PopoverPrimitive.Close data-slot='popover-close' {...props} />
}

export type PopoverContentProps = ComponentProps<typeof PopoverPrimitive.Content> & {
  container?: ComponentProps<typeof PopoverPrimitive.Portal>['container']
}

export function PopoverContent({
  align = 'center',
  className,
  container,
  sideOffset = 6,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        align={align}
        className={cn(
          'z-[1000] rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none',
          className,
        )}
        data-mf-portal=''
        data-slot='popover-content'
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export const Popover = Object.assign(PopoverRoot, {
  Root: PopoverRoot,
  Anchor: PopoverAnchor,
  Trigger: PopoverTrigger,
  Close: PopoverClose,
  Content: PopoverContent,
})
