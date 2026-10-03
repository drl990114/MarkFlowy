import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'
import { focusFeedback } from './focus-styles'

export type InputProps = ComponentProps<'input'> & {
  inputSize?: 'sm' | 'default' | 'lg'
}

export function Input({ className, inputSize = 'default', type, ...props }: InputProps) {
  return (
    <input
      className={cn(
        focusFeedback,
        'w-full min-w-0 rounded-sm border border-input bg-background px-2.5 text-foreground outline-none transition-[color,box-shadow,border-color] duration-[var(--mf-motion-duration-fast)] motion-reduce:transition-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-disabled-foreground disabled:opacity-60 aria-invalid:border-destructive',
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
