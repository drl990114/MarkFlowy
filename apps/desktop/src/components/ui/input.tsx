import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export type InputProps = ComponentProps<'input'> & {
  inputSize?: 'sm' | 'default' | 'lg'
}

export function Input({ className, inputSize = 'default', type, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full min-w-0 rounded-md border border-input bg-background px-2.5 text-foreground shadow-sm outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-disabled-foreground disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/25',
        inputSize === 'sm' && 'h-7 text-ui-control',
        inputSize === 'default' && 'h-8 text-sm',
        inputSize === 'lg' && 'h-9 text-sm',
        className,
      )}
      data-slot='input'
      data-size={inputSize}
      type={type}
      {...props}
    />
  )
}
