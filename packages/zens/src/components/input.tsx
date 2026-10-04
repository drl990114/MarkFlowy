import { useComponentThemeStyle } from '../Theme/components-theme';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { focusFeedback } from './focus-styles';

export type InputProps = ComponentProps<'input'> & {
  inputSize?: 'sm' | 'default' | 'lg';
};

export function Input({ className, inputSize = 'default', type, ...props }: InputProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <input
      className={cn(
        focusFeedback,
        'mfc:w-full mfc:min-w-0 mfc:rounded-sm mfc:border mfc:border-input mfc:bg-background mfc:px-2.5 mfc:text-foreground mfc:outline-none mfc:transition-[color,box-shadow,border-color] mfc:duration-[var(--mf-motion-duration-fast,100ms)] mfc:motion-reduce:transition-none mfc:placeholder:text-muted-foreground mfc:disabled:pointer-events-none mfc:disabled:cursor-not-allowed mfc:disabled:text-disabled-foreground mfc:disabled:opacity-60 mfc:aria-invalid:border-destructive',
        inputSize === 'sm' && 'mfc:h-7 mfc:text-ui-control',
        inputSize === 'default' && 'mfc:h-8 mfc:text-sm',
        inputSize === 'lg' && 'mfc:h-9 mfc:text-sm',
        className,
      )}
      data-mf-component=""
      data-slot="input"
      data-size={inputSize}
      type={type}
      {...props}
      style={componentStyle}
    />
  );
}
