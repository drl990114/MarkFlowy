import { useComponentThemeStyle } from '../Theme/components-theme';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

export function Empty({ className, ...props }: ComponentProps<'div'>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <div
      className={cn(
        'mfc:box-border mfc:flex mfc:h-full mfc:min-h-[120px] mfc:w-full mfc:flex-1 mfc:flex-col mfc:items-center mfc:justify-center mfc:p-4 mfc:text-center mfc:text-ui-caption mfc:text-muted-foreground',
        className,
      )}
      data-mf-component=""
      data-slot="empty"
      {...props}
      style={componentStyle}
    />
  );
}

export function EmptyHeader({ className, ...props }: ComponentProps<'div'>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <div
      className={cn(
        'mfc:flex mfc:max-w-64 mfc:min-w-0 mfc:flex-col mfc:items-center mfc:gap-1.5',
        className,
      )}
      data-mf-component=""
      data-slot="empty-header"
      {...props}
      style={componentStyle}
    />
  );
}

export function EmptyMedia({ className, ...props }: ComponentProps<'div'>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <div
      className={cn(
        'mfc:mb-1 mfc:flex mfc:size-7 mfc:items-center mfc:justify-center mfc:text-content-muted mfc:[&_svg]:shrink-0',
        className,
      )}
      data-mf-component=""
      data-slot="empty-media"
      {...props}
      style={componentStyle}
    />
  );
}

export function EmptyTitle({ className, ...props }: ComponentProps<'div'>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <div
      className={cn('mfc:text-ui-control mfc:font-medium mfc:text-content-secondary', className)}
      data-mf-component=""
      data-slot="empty-title"
      {...props}
      style={componentStyle}
    />
  );
}

export function EmptyDescription({ className, ...props }: ComponentProps<'div'>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <div
      className={cn(
        'mfc:max-w-full mfc:break-words mfc:text-ui-caption mfc:text-muted-foreground',
        className,
      )}
      data-mf-component=""
      data-slot="empty-description"
      {...props}
      style={componentStyle}
    />
  );
}

export function EmptyContent({ className, ...props }: ComponentProps<'div'>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <div
      className={cn('mfc:mt-3 mfc:flex mfc:items-center mfc:justify-center mfc:gap-2', className)}
      data-mf-component=""
      data-slot="empty-content"
      {...props}
      style={componentStyle}
    />
  );
}
