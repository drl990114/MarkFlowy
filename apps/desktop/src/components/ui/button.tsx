import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-ui-control font-medium tracking-[var(--mf-ui-tracking-control)] outline-none transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-[var(--mf-motion-duration-fast)] ease-[var(--mf-motion-ease-out)] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface-app disabled:pointer-events-none disabled:active:scale-100 disabled:text-content-disabled disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100 aria-invalid:border-destructive aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground enabled:hover:opacity-90 disabled:bg-control-surface disabled:text-content-secondary disabled:opacity-100',
        outline:
          'border border-control-border bg-surface-app text-content-primary hover:bg-control-hover hover:text-content-primary',
        ghost:
          'text-content-primary hover:bg-control-ghost-hover hover:text-content-primary',
        chrome:
          'rounded-sm text-content-secondary hover:bg-control-ghost-hover hover:text-content-primary focus-visible:ring-1 focus-visible:ring-offset-0 active:scale-100 active:bg-control-ghost-pressed aria-pressed:text-primary',
        secondary: 'bg-control-surface text-content-primary hover:bg-control-hover',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 rounded-md px-2.5',
        lg: 'h-9 px-4',
        icon: 'size-8 p-0',
        'icon-chrome': 'size-[22px] rounded-sm p-0 [&_svg]:size-3.5',
        'icon-sm': 'size-7 p-0',
        'icon-lg': 'size-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({ asChild = false, className, variant, size, type, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root
        className={cn(buttonVariants({ variant, size }), className)}
        data-slot='button'
        {...props}
      />
    )
  }

  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      data-slot='button'
      type={type ?? 'button'}
      {...props}
    />
  )
}

export { buttonVariants }
