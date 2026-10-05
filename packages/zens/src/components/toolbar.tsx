import { Toolbar as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { useComponentThemeStyle } from '../Theme/components-theme';

export function Toolbar({ className, style, ...props }: ComponentProps<typeof Primitive.Root>) {
  const themeStyle = useComponentThemeStyle(style);
  return (
    <Primitive.Root
      {...props}
      style={themeStyle}
      className={cn('mfc:flex mfc:items-center mfc:gap-1', className)}
      data-slot="toolbar"
      data-mf-component=""
    />
  );
}
export function ToolbarButton({
  className,
  style,
  ...props
}: ComponentProps<typeof Primitive.Button>) {
  const themeStyle = useComponentThemeStyle(style);
  return (
    <Primitive.Button
      type="button"
      {...props}
      style={themeStyle}
      className={cn(
        'mfc:inline-flex mfc:items-center mfc:justify-center mfc:rounded-sm mfc:focus-visible:outline-2 mfc:focus-visible:outline-ring mfc:disabled:opacity-50',
        className,
      )}
      data-slot="toolbar-button"
      data-mf-component=""
    />
  );
}
export function ToolbarSeparator({
  className,
  ...props
}: ComponentProps<typeof Primitive.Separator>) {
  return (
    <Primitive.Separator
      {...props}
      className={cn('mfc:mx-1 mfc:h-4 mfc:w-px mfc:bg-control-border', className)}
      data-slot="toolbar-separator"
    />
  );
}
