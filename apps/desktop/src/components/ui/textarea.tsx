import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'
import { focusFeedback } from './focus-styles'

export type TextareaProps = ComponentProps<'textarea'>

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot='textarea'
      className={cn(
        focusFeedback,
        'box-border min-h-24 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}
