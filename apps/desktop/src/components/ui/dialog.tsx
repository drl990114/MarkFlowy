import { cva, type VariantProps } from 'class-variance-authority'
import { XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { useRef } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './button'

export function DialogRoot(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />
}

export function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot='dialog-trigger' {...props} />
}

export function DialogPortal(props: ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal {...props} />
}

export function DialogClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot='dialog-close' {...props} />
}

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  // Overlay and content intentionally share a layer so a later, nested dialog
  // paints both pieces above an earlier dialog while remaining below popovers.
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-[900] bg-dialog-overlay', className)}
      data-mf-portal=''
      data-slot='dialog-overlay'
      {...props}
    />
  )
}

const dialogContentVariants = cva(
  'fixed top-1/2 left-1/2 z-[900] flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-lg border border-border bg-dialog p-5 text-foreground shadow-lg outline-none',
  {
    variants: {
      size: {
        sm: 'max-w-[28rem]',
        default: 'max-w-[32rem]',
        lg: 'max-w-[40rem]',
        xl: 'max-w-[48rem]',
        full: 'max-w-[80rem]',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof dialogContentVariants> & {
    closeLabel?: string
    container?: ComponentProps<typeof DialogPrimitive.Portal>['container']
  }

export function DialogContent({
  children,
  className,
  closeLabel = 'Close',
  container,
  onCloseAutoFocus,
  onOpenAutoFocus,
  size,
  ...props
}: DialogContentProps) {
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  return (
    <DialogPortal container={container}>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(dialogContentVariants({ size }), className)}
        data-mf-portal=''
        data-slot='dialog-content'
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event)
          if (event.defaultPrevented) return

          event.preventDefault()
          const restoreTarget = restoreFocusRef.current
          restoreFocusRef.current = null
          if (restoreTarget?.isConnected) restoreTarget.focus()
        }}
        onOpenAutoFocus={(event) => {
          const activeElement = typeof document === 'undefined' ? null : document.activeElement
          restoreFocusRef.current =
            typeof HTMLElement !== 'undefined' && activeElement instanceof HTMLElement
              ? activeElement
              : null
          onOpenAutoFocus?.(event)
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button
            aria-label={closeLabel}
            className='absolute top-3 right-3 text-foreground-secondary hover:text-foreground'
            data-slot='dialog-close'
            size='icon-sm'
            variant='ghost'
          >
            <XIcon className='size-4' aria-hidden='true' />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex shrink-0 flex-col gap-1.5 pr-8', className)}
      data-slot='dialog-header'
      {...props}
    />
  )
}

export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'min-h-0 flex-1 overflow-y-auto text-ui-body tracking-[var(--mf-ui-tracking-body)] text-foreground-secondary',
        className,
      )}
      data-slot='dialog-body'
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mt-1 flex shrink-0 flex-wrap items-center justify-end gap-2', className)}
      data-slot='dialog-footer'
      {...props}
    />
  )
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        'text-ui-title font-semibold tracking-[var(--mf-ui-tracking-title)]',
        className,
      )}
      data-slot='dialog-title'
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn(
        'text-ui-body tracking-[var(--mf-ui-tracking-body)] text-foreground-secondary',
        className,
      )}
      data-slot='dialog-description'
      {...props}
    />
  )
}

export const Dialog = Object.assign(DialogRoot, {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Close: DialogClose,
  Overlay: DialogOverlay,
  Content: DialogContent,
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
  Title: DialogTitle,
  Description: DialogDescription,
})

export { dialogContentVariants }
