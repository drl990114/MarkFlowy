import { useComponentThemeStyle } from '../Theme/components-theme';
import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { compactControlFocus } from './focus-styles';

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <SwitchPrimitive.Root
      className={cn(
        compactControlFocus,
        'mfc:peer mfc:inline-flex mfc:h-5 mfc:w-9 mfc:shrink-0 mfc:cursor-default mfc:items-center mfc:rounded-full mfc:border mfc:border-control-border mfc:bg-control-surface mfc:transition-[background-color,border-color] mfc:duration-[var(--mf-motion-duration-fast,100ms)] mfc:ease-[var(--mf-motion-ease-out,cubic-bezier(0.23,_1,_0.32,_1))] mfc:disabled:cursor-not-allowed mfc:disabled:opacity-50 mfc:motion-reduce:transition-none mfc:data-[state=checked]:border-primary mfc:data-[state=checked]:bg-primary',
        className,
      )}
      data-mf-component=""
      data-slot="switch"
      {...props}
      style={componentStyle}
    >
      <SwitchPrimitive.Thumb
        className="mfc:pointer-events-none mfc:block mfc:size-4 mfc:rounded-full mfc:bg-surface-elevated mfc:shadow-sm mfc:transition-transform mfc:duration-[var(--mf-motion-duration-fast,100ms)] mfc:ease-[var(--mf-motion-ease-out,cubic-bezier(0.23,_1,_0.32,_1))] mfc:motion-reduce:transition-none mfc:dark:bg-content-primary mfc:data-[state=checked]:translate-x-4 mfc:data-[state=unchecked]:translate-x-0"
        data-mf-component=""
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}
