import { useComponentThemeStyle } from '../Theme/components-theme';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { focusFeedback } from './focus-styles';

const buttonVariants = cva(
  [
    focusFeedback,
    'mfc:inline-flex mfc:shrink-0 mfc:items-center mfc:justify-center mfc:gap-1.5 mfc:rounded-sm mfc:text-ui-control mfc:font-medium mfc:tracking-[var(--mf-ui-tracking-control,0)] mfc:outline-none mfc:transition-[color,background-color,border-color,box-shadow,opacity] mfc:duration-[var(--mf-motion-duration-fast,100ms)] mfc:ease-[var(--mf-motion-ease-out,cubic-bezier(0.23,_1,_0.32,_1))] mfc:disabled:pointer-events-none mfc:disabled:text-content-disabled mfc:disabled:opacity-60 mfc:motion-reduce:transition-none mfc:aria-invalid:border-destructive mfc:[&_svg]:pointer-events-none mfc:[&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default:
          'mfc:bg-primary mfc:text-primary-foreground mfc:enabled:hover:opacity-90 mfc:enabled:active:bg-primary/80 mfc:enabled:active:opacity-100 mfc:focus-visible:ring-primary-foreground mfc:disabled:bg-control-surface mfc:disabled:text-content-secondary mfc:disabled:opacity-100',
        outline:
          'mfc:border mfc:border-control-border mfc:bg-surface-app mfc:text-content-primary mfc:hover:bg-control-hover mfc:hover:text-content-primary mfc:active:bg-control-pressed',
        ghost:
          'mfc:text-content-primary mfc:hover:bg-control-ghost-hover mfc:hover:text-content-primary mfc:active:bg-control-ghost-pressed',
        chrome:
          'mfc:rounded-sm mfc:text-content-secondary mfc:hover:bg-control-ghost-hover mfc:hover:text-content-primary mfc:active:bg-control-ghost-pressed mfc:aria-pressed:text-primary',
        secondary:
          'mfc:bg-control-surface mfc:text-content-primary mfc:hover:bg-control-hover mfc:active:bg-control-pressed',
        destructive:
          'mfc:bg-destructive mfc:text-destructive-foreground mfc:hover:opacity-90 mfc:active:bg-destructive/80 mfc:active:opacity-100 mfc:focus-visible:ring-destructive-foreground',
        link: 'mfc:text-primary mfc:underline-offset-4 mfc:hover:underline mfc:active:opacity-75',
      },
      size: {
        default: 'mfc:h-8 mfc:px-3',
        sm: 'mfc:h-7 mfc:rounded-sm mfc:px-2.5',
        lg: 'mfc:h-9 mfc:px-4',
        icon: 'mfc:size-8 mfc:p-0',
        'icon-chrome': 'mfc:size-[22px] mfc:rounded-sm mfc:p-0 mfc:[&_svg]:size-3.5',
        'icon-sm': 'mfc:size-7 mfc:p-0',
        'icon-lg': 'mfc:size-9 mfc:p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ asChild = false, className, variant, size, type, ...props }: ButtonProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  if (asChild) {
    return (
      <Slot.Root
        className={cn(buttonVariants({ variant, size }), className)}
        data-mf-component=""
        data-slot="button"
        {...props}
        style={componentStyle}
      />
    );
  }

  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      data-mf-component=""
      data-slot="button"
      type={type ?? 'button'}
      {...props}
      style={componentStyle}
    />
  );
}

export { buttonVariants };
