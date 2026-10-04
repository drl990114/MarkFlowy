import { useComponentThemeStyle } from '../Theme/components-theme';
import { cva, type VariantProps } from 'class-variance-authority';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { useRef } from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';

export function DialogRoot(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

export function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <DialogPrimitive.Trigger
      data-mf-component=""
      data-slot="dialog-trigger"
      {...props}
      style={componentStyle}
    />
  );
}

export function DialogPortal(props: ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal {...props} />;
}

export function DialogClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <DialogPrimitive.Close
      data-mf-component=""
      data-slot="dialog-close"
      {...props}
      style={componentStyle}
    />
  );
}

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  const componentStyle = useComponentThemeStyle(props.style);

  // Overlay and content intentionally share a layer so a later, nested dialog
  // paints both pieces above an earlier dialog while remaining below popovers.
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'mfc:fixed mfc:inset-0 mfc:z-[var(--mf-layer-dialog,900)] mfc:bg-dialog-overlay',
        className,
      )}
      data-mf-portal=""
      data-mf-component=""
      data-slot="dialog-overlay"
      {...props}
      style={componentStyle}
    />
  );
}

const dialogContentVariants = cva(
  'mfc:fixed mfc:top-1/2 mfc:left-1/2 mfc:z-[var(--mf-layer-dialog,900)] mfc:flex mfc:max-h-[calc(100vh-2rem)] mfc:w-[calc(100vw-2rem)] mfc:-translate-x-1/2 mfc:-translate-y-1/2 mfc:flex-col mfc:gap-4 mfc:overflow-hidden mfc:rounded-lg mfc:border mfc:border-control-border mfc:bg-surface-elevated mfc:p-5 mfc:text-content-primary mfc:shadow-lg mfc:outline-none',
  {
    variants: {
      size: {
        sm: 'mfc:max-w-[28rem]',
        default: 'mfc:max-w-[32rem]',
        lg: 'mfc:max-w-[40rem]',
        xl: 'mfc:max-w-[48rem]',
        full: 'mfc:max-w-[80rem]',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof dialogContentVariants> & {
    closeLabel?: string;
    container?: ComponentProps<typeof DialogPrimitive.Portal>['container'];
  };

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
  const componentStyle = useComponentThemeStyle(props.style);

  const restoreFocusRef = useRef<HTMLElement | null>(null);

  return (
    <DialogPortal container={container}>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(dialogContentVariants({ size }), className)}
        data-mf-portal=""
        data-mf-component=""
        data-slot="dialog-content"
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;

          event.preventDefault();
          const restoreTarget = restoreFocusRef.current;
          restoreFocusRef.current = null;
          if (restoreTarget?.isConnected) restoreTarget.focus();
        }}
        onOpenAutoFocus={(event) => {
          const activeElement = typeof document === 'undefined' ? null : document.activeElement;
          restoreFocusRef.current =
            typeof HTMLElement !== 'undefined' && activeElement instanceof HTMLElement
              ? activeElement
              : null;
          onOpenAutoFocus?.(event);
        }}
        {...props}
        style={componentStyle}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button
            aria-label={closeLabel}
            className="mfc:absolute mfc:top-3 mfc:right-3 mfc:text-content-secondary mfc:hover:text-content-primary"
            data-mf-component=""
            data-slot="dialog-close"
            size="icon-sm"
            variant="ghost"
          >
            <XIcon className="mfc:size-4" aria-hidden="true" />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <div
      className={cn('mfc:flex mfc:shrink-0 mfc:flex-col mfc:gap-1.5 mfc:pr-8', className)}
      data-mf-component=""
      data-slot="dialog-header"
      {...props}
      style={componentStyle}
    />
  );
}

export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <div
      className={cn(
        'mfc:min-h-0 mfc:flex-1 mfc:overflow-y-auto mfc:text-ui-body mfc:tracking-[var(--mf-ui-tracking-body,0)] mfc:text-content-secondary',
        className,
      )}
      data-mf-component=""
      data-slot="dialog-body"
      {...props}
      style={componentStyle}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <div
      className={cn(
        'mfc:mt-1 mfc:flex mfc:shrink-0 mfc:flex-wrap mfc:items-center mfc:justify-end mfc:gap-2',
        className,
      )}
      data-mf-component=""
      data-slot="dialog-footer"
      {...props}
      style={componentStyle}
    />
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <DialogPrimitive.Title
      className={cn(
        'mfc:text-ui-title mfc:font-semibold mfc:tracking-[var(--mf-ui-tracking-title,0)]',
        className,
      )}
      data-mf-component=""
      data-slot="dialog-title"
      {...props}
      style={componentStyle}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <DialogPrimitive.Description
      className={cn(
        'mfc:text-ui-body mfc:tracking-[var(--mf-ui-tracking-body,0)] mfc:text-content-secondary',
        className,
      )}
      data-mf-component=""
      data-slot="dialog-description"
      {...props}
      style={componentStyle}
    />
  );
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
});

export { dialogContentVariants };
