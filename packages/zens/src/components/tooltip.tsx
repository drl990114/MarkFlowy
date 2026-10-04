import { useComponentThemeStyle } from '../Theme/components-theme';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

export function TooltipProvider({
  delayDuration = 100,
  skipDelayDuration = 0,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}

export function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props} />;
}

export function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <TooltipPrimitive.Trigger
      data-mf-component=""
      data-slot="tooltip-trigger"
      {...props}
      style={componentStyle}
    />
  );
}

export type TooltipContentProps = ComponentProps<typeof TooltipPrimitive.Content> & {
  container?: ComponentProps<typeof TooltipPrimitive.Portal>['container'];
};

export function TooltipContent({
  className,
  container,
  sideOffset = 5,
  ...props
}: TooltipContentProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content
        className={cn(
          'mfc:z-[var(--mf-layer-tooltip,1001)] mfc:rounded-md mfc:border mfc:border-control-border mfc:bg-surface-tooltip mfc:px-2 mfc:py-1 mfc:text-ui-caption mfc:tracking-[var(--mf-ui-tracking-caption,0)] mfc:text-content-primary mfc:shadow-sm',
          className,
        )}
        data-mf-portal=""
        data-mf-component=""
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        {...props}
        style={componentStyle}
      />
    </TooltipPrimitive.Portal>
  );
}
