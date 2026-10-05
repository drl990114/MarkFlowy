import { useComponentThemeStyle } from '../Theme/components-theme';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { Input, type InputProps } from './input';

export type InputGroupRootProps = ComponentProps<'div'>;

export function InputGroupRoot({ className, ...props }: InputGroupRootProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <div
      className={cn(
        'mfc:group/input-group mfc:relative mfc:flex mfc:w-full mfc:min-w-0 mfc:items-center mfc:rounded-sm mfc:border mfc:border-input mfc:bg-background mfc:transition-[color,box-shadow,border-color] mfc:has-[[aria-invalid=true]]:border-destructive',
        className,
      )}
      data-mf-component=""
      data-slot="input-group"
      {...props}
      style={componentStyle}
    />
  );
}

export function InputGroupInput({ className, ...props }: InputProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <Input
      className={cn(
        'mfc:min-w-0 mfc:flex-1 mfc:border-0 mfc:bg-transparent mfc:shadow-none',
        className,
      )}
      data-mf-component=""
      data-slot="input-group-input"
      {...props}
      style={componentStyle}
    />
  );
}

export type InputGroupAddonProps = ComponentProps<'div'> & {
  align?: 'inline-start' | 'inline-end';
  asChild?: boolean;
};

export function InputGroupAddon({
  align = 'inline-start',
  asChild = false,
  className,
  ...props
}: InputGroupAddonProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  const Component = asChild ? Slot.Root : 'div';

  return (
    <Component
      className={cn(
        'mfc:flex mfc:h-full mfc:shrink-0 mfc:items-center mfc:gap-1.5 mfc:px-2 mfc:text-xs mfc:text-muted-foreground mfc:[&_svg]:size-3.5',
        align === 'inline-start'
          ? 'mfc:order-first mfc:border-r mfc:border-border'
          : 'mfc:order-last mfc:border-l mfc:border-border',
        className,
      )}
      data-align={align}
      data-mf-component=""
      data-slot="input-group-addon"
      {...props}
      style={componentStyle}
    />
  );
}

export const InputGroup = Object.assign(InputGroupRoot, {
  Root: InputGroupRoot,
  Input: InputGroupInput,
  Addon: InputGroupAddon,
});
