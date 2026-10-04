import { useComponentThemeStyle } from '../Theme/components-theme';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { CircleIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { compactControlFocus } from './focus-styles';

export function RadioGroupRoot({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <RadioGroupPrimitive.Root
      className={cn('mfc:grid mfc:gap-2', className)}
      data-mf-component=""
      data-slot="radio-group"
      {...props}
      style={componentStyle}
    />
  );
}

export function RadioGroupItem({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <RadioGroupPrimitive.Item
      className={cn(
        compactControlFocus,
        'mfc:aspect-square mfc:size-4 mfc:shrink-0 mfc:cursor-default mfc:rounded-full mfc:border mfc:border-input mfc:bg-background mfc:text-primary mfc:transition-colors mfc:duration-[var(--mf-motion-duration-fast,100ms)] mfc:disabled:cursor-not-allowed mfc:disabled:opacity-50 mfc:motion-reduce:transition-none mfc:data-[state=checked]:border-primary',
        className,
      )}
      data-mf-component=""
      data-slot="radio-group-item"
      {...props}
      style={componentStyle}
    >
      <RadioGroupPrimitive.Indicator
        className="mfc:relative mfc:flex mfc:items-center mfc:justify-center"
        data-mf-component=""
        data-slot="radio-group-indicator"
      >
        <CircleIcon className="mfc:size-2 mfc:fill-current" aria-hidden="true" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export const RadioGroup = Object.assign(RadioGroupRoot, {
  Root: RadioGroupRoot,
  Item: RadioGroupItem,
});
