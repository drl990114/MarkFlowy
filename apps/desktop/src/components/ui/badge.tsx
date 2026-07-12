import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border text-xs font-medium whitespace-nowrap transition-colors [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
      },
      size: {
        sm: 'px-1.5 py-0.5',
        default: 'px-2 py-1',
      },
    },
    defaultVariants: {
      variant: 'outline',
      size: 'default',
    },
  },
)

export type BadgeProps = ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
  }

export function Badge({ asChild = false, className, variant, size, ...props }: BadgeProps) {
  const Component = asChild ? Slot.Root : 'span'

  return (
    <Component
      className={cn(badgeVariants({ variant, size }), className)}
      data-slot='badge'
      {...props}
    />
  )
}

export { badgeVariants }
