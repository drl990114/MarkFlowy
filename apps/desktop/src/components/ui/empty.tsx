import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function Empty({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'box-border flex h-full min-h-[120px] w-full flex-1 flex-col items-center justify-center p-4 text-center text-xs leading-[1.5] text-muted-foreground',
        className,
      )}
      data-slot='empty'
      {...props}
    />
  )
}

export function EmptyHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex max-w-[220px] flex-col items-center gap-1', className)}
      data-slot='empty-header'
      {...props}
    />
  )
}

export function EmptyMedia({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mb-[3px] text-xl leading-none opacity-[0.72]', className)}
      data-slot='empty-media'
      {...props}
    />
  )
}

export function EmptyTitle({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('font-normal text-inherit', className)}
      data-slot='empty-title'
      {...props}
    />
  )
}

export function EmptyDescription({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('text-inherit', className)}
      data-slot='empty-description'
      {...props}
    />
  )
}
