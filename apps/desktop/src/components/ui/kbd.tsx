import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export type KbdProps = ComponentProps<'kbd'>
export type KbdGroupProps = ComponentProps<'span'>

export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        'box-border inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[3px] border border-control-border bg-muted/50 px-1 font-sans text-ui-caption font-normal leading-none tracking-normal',
        className,
      )}
      data-slot='kbd'
      {...props}
    />
  )
}

export function KbdGroup({ className, ...props }: KbdGroupProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap align-middle text-content-secondary',
        className,
      )}
      data-slot='kbd-group'
      {...props}
    />
  )
}
