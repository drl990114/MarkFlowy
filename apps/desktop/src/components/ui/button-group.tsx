import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export type ButtonGroupRootProps = ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical'
}

export function ButtonGroupRoot({
  className,
  orientation = 'horizontal',
  role = 'group',
  ...props
}: ButtonGroupRootProps) {
  return (
    <div
      className={cn(
        'inline-flex w-fit items-stretch [&>[data-slot=button]]:relative [&>[data-slot=button]]:z-0 [&>[data-slot=button]:focus-visible]:z-10',
        orientation === 'horizontal' &&
          '[&>[data-slot=button]:not(:first-child)]:-ml-px [&>[data-slot=button]:not(:first-child)]:rounded-l-none [&>[data-slot=button]:not(:last-child)]:rounded-r-none',
        orientation === 'vertical' &&
          'flex-col [&>[data-slot=button]:not(:first-child)]:-mt-px [&>[data-slot=button]:not(:first-child)]:rounded-t-none [&>[data-slot=button]:not(:last-child)]:rounded-b-none',
        className,
      )}
      data-orientation={orientation}
      data-slot='button-group'
      role={role}
      {...props}
    />
  )
}

export type ButtonGroupSeparatorProps = ComponentProps<'div'> & {
  asChild?: boolean
  orientation?: 'horizontal' | 'vertical'
}

export function ButtonGroupSeparator({
  asChild = false,
  className,
  orientation = 'vertical',
  ...props
}: ButtonGroupSeparatorProps) {
  const Component = asChild ? Slot.Root : 'div'

  return (
    <Component
      aria-orientation={orientation}
      className={cn(
        'self-stretch bg-border',
        orientation === 'vertical' ? 'w-px' : 'h-px',
        className,
      )}
      data-orientation={orientation}
      data-slot='button-group-separator'
      role='separator'
      {...props}
    />
  )
}

export const ButtonGroup = Object.assign(ButtonGroupRoot, {
  Root: ButtonGroupRoot,
  Separator: ButtonGroupSeparator,
})
