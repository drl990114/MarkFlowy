import { useComponentThemeStyle } from '../Theme/components-theme';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

export type KbdProps = ComponentProps<'kbd'>;
export type KbdGroupProps = ComponentProps<'span'>;

export function Kbd({ className, ...props }: KbdProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <kbd
      className={cn(
        'mfc:inline-flex mfc:h-5 mfc:shrink-0 mfc:items-center mfc:justify-center mfc:font-sans mfc:text-ui-caption mfc:font-normal mfc:leading-none mfc:tracking-normal',
        className,
      )}
      data-mf-component=""
      data-slot="kbd"
      {...props}
      style={componentStyle}
    />
  );
}

export function KbdGroup({ className, ...props }: KbdGroupProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <span
      className={cn(
        'mfc:inline-flex mfc:shrink-0 mfc:items-center mfc:gap-0.5 mfc:whitespace-nowrap mfc:align-middle mfc:font-sans mfc:text-ui-caption mfc:font-normal mfc:leading-none mfc:tracking-normal mfc:text-content-secondary',
        className,
      )}
      data-mf-component=""
      data-slot="kbd-group"
      {...props}
      style={componentStyle}
    />
  );
}
