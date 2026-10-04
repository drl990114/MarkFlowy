import { useComponentThemeStyle } from '../Theme/components-theme';
import { Toggle as TogglePrimitive } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { focusFeedback } from './focus-styles';

const toggleVariants = cva(
  [
    focusFeedback,
    'mfc:inline-flex mfc:shrink-0 mfc:items-center mfc:justify-center mfc:gap-1.5 mfc:rounded-sm mfc:text-ui-control mfc:font-medium mfc:outline-none mfc:transition-[color,background-color,border-color,box-shadow] mfc:duration-[var(--mf-motion-duration-fast,100ms)] mfc:motion-reduce:transition-none mfc:hover:text-content-primary mfc:disabled:pointer-events-none mfc:disabled:opacity-50 mfc:data-[state=on]:bg-primary mfc:data-[state=on]:text-primary-foreground mfc:[&_svg]:pointer-events-none mfc:[&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default:
          'mfc:bg-transparent mfc:hover:bg-control-ghost-hover mfc:active:bg-control-ghost-pressed',
        outline:
          'mfc:border mfc:border-input mfc:bg-background mfc:hover:bg-control-hover mfc:active:bg-control-pressed',
      },
      size: {
        default: 'mfc:h-8 mfc:min-w-8 mfc:px-2.5',
        sm: 'mfc:h-7 mfc:min-w-7 mfc:px-2',
        lg: 'mfc:h-9 mfc:min-w-9 mfc:px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ToggleProps = ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>;

export function Toggle({ className, size, variant, ...props }: ToggleProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <TogglePrimitive.Root
      className={cn(toggleVariants({ size, variant }), className)}
      data-mf-component=""
      data-slot="toggle"
      {...props}
      style={componentStyle}
    />
  );
}

export { toggleVariants };
