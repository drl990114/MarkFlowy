import { useComponentThemeStyle } from '../Theme/components-theme';
import { Popover as PopoverPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

export function PopoverRoot(props: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root {...props} />;
}

export function PopoverAnchor(props: ComponentProps<typeof PopoverPrimitive.Anchor>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <PopoverPrimitive.Anchor
      data-mf-component=""
      data-slot="popover-anchor"
      {...props}
      style={componentStyle}
    />
  );
}

export function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <PopoverPrimitive.Trigger
      data-mf-component=""
      data-slot="popover-trigger"
      {...props}
      style={componentStyle}
    />
  );
}

export function PopoverClose(props: ComponentProps<typeof PopoverPrimitive.Close>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <PopoverPrimitive.Close
      data-mf-component=""
      data-slot="popover-close"
      {...props}
      style={componentStyle}
    />
  );
}

export type PopoverContentProps = ComponentProps<typeof PopoverPrimitive.Content> & {
  container?: ComponentProps<typeof PopoverPrimitive.Portal>['container'];
};

export function PopoverContent({
  align = 'center',
  className,
  container,
  sideOffset = 6,
  ...props
}: PopoverContentProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        align={align}
        className={cn(
          'mfc:z-[var(--mf-layer-popover,1000)] mfc:rounded-lg mfc:border mfc:border-control-border mfc:bg-surface-overlay mfc:p-2 mfc:text-content-primary mfc:shadow-lg mfc:outline-none',
          className,
        )}
        data-mf-portal=""
        data-mf-component=""
        data-slot="popover-content"
        sideOffset={sideOffset}
        {...props}
        style={componentStyle}
      />
    </PopoverPrimitive.Portal>
  );
}

export const Popover = Object.assign(PopoverRoot, {
  Root: PopoverRoot,
  Anchor: PopoverAnchor,
  Trigger: PopoverTrigger,
  Close: PopoverClose,
  Content: PopoverContent,
});
