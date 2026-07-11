import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

export const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        outline:
          'border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        destructive: 'border border-destructive bg-muted text-destructive',
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
  return <Component className={cn(badgeVariants({ variant, size }), className)} {...props} />
}
