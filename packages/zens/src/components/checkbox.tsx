import { useComponentThemeStyle } from '../Theme/components-theme';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { CheckIcon, MinusIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { compactControlFocus } from './focus-styles';

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <CheckboxPrimitive.Root
      className={cn(
        compactControlFocus,
        'mfc:peer mfc:size-4 mfc:shrink-0 mfc:cursor-default mfc:rounded-[var(--mf-radius-sm)] mfc:border mfc:border-input mfc:bg-background mfc:text-primary-foreground mfc:transition-colors mfc:duration-[var(--mf-motion-duration-fast,100ms)] mfc:disabled:cursor-not-allowed mfc:disabled:opacity-50 mfc:motion-reduce:transition-none mfc:data-[state=checked]:border-primary mfc:data-[state=checked]:bg-primary mfc:data-[state=indeterminate]:border-primary mfc:data-[state=indeterminate]:bg-primary mfc:[&[data-state=indeterminate]_[data-slot=checkbox-check]]:hidden mfc:[&[data-state=indeterminate]_[data-slot=checkbox-minus]]:block',
        className,
      )}
      data-mf-component=""
      data-slot="checkbox"
      {...props}
      style={componentStyle}
    >
      <CheckboxPrimitive.Indicator
        className="mfc:flex mfc:items-center mfc:justify-center mfc:text-current"
        data-mf-component=""
        data-slot="checkbox-indicator"
      >
        <CheckIcon
          className="mfc:size-3"
          aria-hidden="true"
          data-mf-component=""
          data-slot="checkbox-check"
        />
        <MinusIcon
          className="mfc:hidden mfc:size-3"
          aria-hidden="true"
          data-mf-component=""
          data-slot="checkbox-minus"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
