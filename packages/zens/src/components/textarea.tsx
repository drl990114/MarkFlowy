import { useComponentThemeStyle } from '../Theme/components-theme';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { focusFeedback } from './focus-styles';

export type TextareaProps = ComponentProps<'textarea'>;

export function Textarea({ className, ...props }: TextareaProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <textarea
      data-mf-component=""
      data-slot="textarea"
      className={cn(
        focusFeedback,
        'mfc:box-border mfc:min-h-24 mfc:w-full mfc:min-w-0 mfc:rounded-sm mfc:border mfc:border-input mfc:bg-background mfc:px-3 mfc:py-2 mfc:text-sm mfc:text-foreground mfc:outline-none mfc:placeholder:text-muted-foreground mfc:disabled:cursor-not-allowed mfc:disabled:opacity-60 mfc:aria-invalid:border-destructive',
        className,
      )}
      {...props}
      style={componentStyle}
    />
  );
}
