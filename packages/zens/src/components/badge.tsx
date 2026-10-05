import { useComponentThemeStyle } from '../Theme/components-theme';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'mfc:inline-flex mfc:w-fit mfc:shrink-0 mfc:items-center mfc:justify-center mfc:gap-1 mfc:overflow-hidden mfc:rounded-sm mfc:border mfc:text-ui-caption mfc:font-normal mfc:whitespace-nowrap mfc:[&_svg]:pointer-events-none mfc:[&_svg]:size-3 mfc:[&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'mfc:border-transparent mfc:bg-primary mfc:text-primary-foreground',
        outline: 'mfc:border-border mfc:bg-transparent mfc:text-muted-foreground',
        secondary: 'mfc:border-transparent mfc:bg-secondary mfc:text-secondary-foreground',
        destructive: 'mfc:border-transparent mfc:bg-destructive mfc:text-destructive-foreground',
      },
      size: {
        sm: 'mfc:min-h-5 mfc:px-1.5',
        default: 'mfc:min-h-6 mfc:px-2',
      },
    },
    defaultVariants: {
      variant: 'outline',
      size: 'default',
    },
  },
);

export type BadgeProps = ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  };

export function Badge({ asChild = false, className, variant, size, ...props }: BadgeProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  const Component = asChild ? Slot.Root : 'span';

  return (
    <Component
      className={cn(badgeVariants({ variant, size }), className)}
      data-mf-component=""
      data-slot="badge"
      {...props}
      style={componentStyle}
    />
  );
}

export { badgeVariants };
