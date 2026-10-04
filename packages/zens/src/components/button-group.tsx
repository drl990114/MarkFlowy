import { useComponentThemeStyle } from '../Theme/components-theme';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

export type ButtonGroupRootProps = ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical';
};

export function ButtonGroupRoot({
  className,
  orientation = 'horizontal',
  role = 'group',
  ...props
}: ButtonGroupRootProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <div
      className={cn(
        'mfc:inline-flex mfc:w-fit mfc:items-stretch mfc:[&>[data-slot=button]]:relative mfc:[&>[data-slot=button]]:z-0 mfc:[&>[data-slot=button]:focus-visible]:z-10',
        orientation === 'horizontal' &&
          'mfc:[&>[data-slot=button]:not(:first-child)]:-ml-px mfc:[&>[data-slot=button]:not(:first-child)]:rounded-l-none mfc:[&>[data-slot=button]:not(:last-child)]:rounded-r-none',
        orientation === 'vertical' &&
          'mfc:flex-col mfc:[&>[data-slot=button]:not(:first-child)]:-mt-px mfc:[&>[data-slot=button]:not(:first-child)]:rounded-t-none mfc:[&>[data-slot=button]:not(:last-child)]:rounded-b-none',
        className,
      )}
      data-orientation={orientation}
      data-mf-component=""
      data-slot="button-group"
      role={role}
      {...props}
      style={componentStyle}
    />
  );
}

export type ButtonGroupSeparatorProps = ComponentProps<'div'> & {
  asChild?: boolean;
  orientation?: 'horizontal' | 'vertical';
};

export function ButtonGroupSeparator({
  asChild = false,
  className,
  orientation = 'vertical',
  ...props
}: ButtonGroupSeparatorProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  const Component = asChild ? Slot.Root : 'div';

  return (
    <Component
      aria-orientation={orientation}
      className={cn(
        'mfc:self-stretch mfc:bg-border',
        orientation === 'vertical' ? 'mfc:w-px' : 'mfc:h-px',
        className,
      )}
      data-orientation={orientation}
      data-mf-component=""
      data-slot="button-group-separator"
      role="separator"
      {...props}
      style={componentStyle}
    />
  );
}

export const ButtonGroup = Object.assign(ButtonGroupRoot, {
  Root: ButtonGroupRoot,
  Separator: ButtonGroupSeparator,
});
