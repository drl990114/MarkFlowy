import { Toggle as TogglePrimitive } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

const toggleVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium outline-none transition-[color,background-color,border-color,box-shadow] hover:text-content-primary focus-visible:ring-2 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-transparent hover:bg-control-ghost-hover active:bg-control-ghost-pressed',
        outline:
          'border border-input bg-background shadow-sm hover:bg-control-hover active:bg-control-pressed',
      },
      size: {
        default: 'h-8 min-w-8 px-2.5',
        sm: 'h-7 min-w-7 px-2 text-xs',
        lg: 'h-9 min-w-9 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ToggleProps = ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>

export function Toggle({ className, size, variant, ...props }: ToggleProps) {
  return (
    <TogglePrimitive.Root
      className={cn(toggleVariants({ size, variant }), className)}
      data-slot='toggle'
      {...props}
    />
  )
}

export { toggleVariants }
