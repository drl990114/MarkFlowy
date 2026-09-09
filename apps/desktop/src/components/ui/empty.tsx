import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function Empty({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'box-border flex h-full min-h-[120px] w-full flex-1 flex-col items-center justify-center p-4 text-center text-ui-caption text-muted-foreground',
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
      className={cn('flex max-w-64 min-w-0 flex-col items-center gap-1.5', className)}
      data-slot='empty-header'
      {...props}
    />
  )
}

export function EmptyMedia({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mb-1 flex size-7 items-center justify-center text-content-muted [&_svg]:shrink-0', className)}
      data-slot='empty-media'
      {...props}
    />
  )
}

export function EmptyTitle({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('text-ui-control font-medium text-content-secondary', className)}
      data-slot='empty-title'
      {...props}
    />
  )
}

export function EmptyDescription({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('max-w-full break-words text-ui-caption text-muted-foreground', className)}
      data-slot='empty-description'
      {...props}
    />
  )
}

export function EmptyContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mt-3 flex items-center justify-center gap-2', className)}
      data-slot='empty-content'
      {...props}
    />
  )
}
