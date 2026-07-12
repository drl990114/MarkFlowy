import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'
import { Input, type InputProps } from '@/components/ui/input'

export type InputGroupRootProps = ComponentProps<'div'>

export function InputGroupRoot({ className, ...props }: InputGroupRootProps) {
  return (
    <div
      className={cn(
        'group/input-group relative flex w-full min-w-0 items-center rounded-md border border-input bg-background shadow-sm transition-[color,box-shadow,border-color] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/25',
        className,
      )}
      data-slot='input-group'
      {...props}
    />
  )
}

export function InputGroupInput({ className, ...props }: InputProps) {
  return (
    <Input
      className={cn(
        'min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0',
        className,
      )}
      data-slot='input-group-input'
      {...props}
    />
  )
}

export type InputGroupAddonProps = ComponentProps<'div'> & {
  align?: 'inline-start' | 'inline-end'
  asChild?: boolean
}

export function InputGroupAddon({
  align = 'inline-start',
  asChild = false,
  className,
  ...props
}: InputGroupAddonProps) {
  const Component = asChild ? Slot.Root : 'div'

  return (
    <Component
      className={cn(
        'flex h-full shrink-0 items-center gap-1.5 px-2 text-xs text-muted-foreground [&_svg]:size-3.5',
        align === 'inline-start' ? 'order-first border-r border-border' : 'order-last border-l border-border',
        className,
      )}
      data-align={align}
      data-slot='input-group-addon'
      {...props}
    />
  )
}

export const InputGroup = Object.assign(InputGroupRoot, {
  Root: InputGroupRoot,
  Input: InputGroupInput,
  Addon: InputGroupAddon,
})
