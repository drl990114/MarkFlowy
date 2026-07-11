import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

const buttonVariants = cva(
  'aui-button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium outline-none transition-[color,background-color,border-color,opacity] focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-disabled-foreground disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        outline: 'border border-border bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
      },
      size: {
        default: 'h-7 px-3',
        sm: 'h-6 rounded-md px-2 text-xs',
        icon: 'size-7 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({ asChild = false, className, variant, size, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : 'button'

  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      data-slot='aui-button'
      {...props}
    />
  )
}

export { buttonVariants }
