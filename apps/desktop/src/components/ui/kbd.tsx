import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export type KbdProps = ComponentProps<'kbd'>
export type KbdGroupProps = ComponentProps<'span'>

export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 shrink-0 items-center justify-center font-sans text-ui-caption font-normal leading-none tracking-normal',
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
        'inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap align-middle font-sans text-ui-caption font-normal leading-none tracking-normal text-content-secondary',
        className,
      )}
      data-slot='kbd-group'
      {...props}
    />
  )
}
