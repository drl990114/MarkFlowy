import { useComponentThemeStyle } from '../Theme/components-theme';
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

export function ContextMenuRoot(props: ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root {...props} />;
}

export function ContextMenuTrigger(props: ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <ContextMenuPrimitive.Trigger
      data-mf-component=""
      data-slot="context-menu-trigger"
      {...props}
      style={componentStyle}
    />
  );
}

export function ContextMenuPortal(props: ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return <ContextMenuPrimitive.Portal {...props} />;
}

const contentClassName =
  'mfc:z-[var(--mf-layer-menu,1000)] mfc:max-h-[var(--radix-context-menu-content-available-height)] mfc:min-w-36 mfc:overflow-x-hidden mfc:overflow-y-auto mfc:rounded-lg mfc:border mfc:border-control-border mfc:bg-surface-overlay mfc:p-1 mfc:text-content-primary mfc:shadow-lg mfc:outline-none';

export type ContextMenuContentProps = ComponentProps<typeof ContextMenuPrimitive.Content> & {
  container?: ComponentProps<typeof ContextMenuPrimitive.Portal>['container'];
};

export function ContextMenuContent({
  className,
  collisionPadding = 8,
  container,
  ...props
}: ContextMenuContentProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <ContextMenuPortal container={container}>
      <ContextMenuPrimitive.Content
        className={cn(contentClassName, className)}
        collisionPadding={collisionPadding}
        data-mf-portal=""
        data-mf-component=""
        data-slot="context-menu-content"
        {...props}
        style={componentStyle}
      />
    </ContextMenuPortal>
  );
}

export function ContextMenuGroup(props: ComponentProps<typeof ContextMenuPrimitive.Group>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <ContextMenuPrimitive.Group
      data-mf-component=""
      data-slot="context-menu-group"
      {...props}
      style={componentStyle}
    />
  );
}

export function ContextMenuLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Label> & { inset?: boolean }) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <ContextMenuPrimitive.Label
      className={cn(
        'mfc:px-2 mfc:py-1.5 mfc:text-ui-caption mfc:font-medium mfc:tracking-[var(--mf-ui-tracking-caption,0)] mfc:text-content-muted',
        inset && 'mfc:pl-8',
        className,
      )}
      data-inset={inset ? '' : undefined}
      data-mf-component=""
      data-slot="context-menu-label"
      {...props}
      style={componentStyle}
    />
  );
}

const itemClassName =
  'mfc:relative mfc:flex mfc:min-h-7 mfc:cursor-default mfc:select-none mfc:items-center mfc:gap-2 mfc:rounded-sm mfc:px-2 mfc:py-1 mfc:text-ui-control mfc:tracking-[var(--mf-ui-tracking-control,0)] mfc:text-content-primary mfc:outline-none mfc:data-[disabled]:pointer-events-none mfc:data-[disabled]:text-content-disabled mfc:data-[disabled]:opacity-60 mfc:data-[highlighted]:bg-control-hover mfc:data-[highlighted]:text-content-primary mfc:[&_svg]:pointer-events-none mfc:[&_svg]:size-3.5 mfc:[&_svg]:shrink-0';

export function ContextMenuItem({
  className,
  inset,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Item> & { inset?: boolean }) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <ContextMenuPrimitive.Item
      className={cn(itemClassName, inset && 'mfc:pl-8', className)}
      data-inset={inset ? '' : undefined}
      data-mf-component=""
      data-slot="context-menu-item"
      {...props}
      style={componentStyle}
    />
  );
}

export function ContextMenuCheckboxItem({
  children,
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <ContextMenuPrimitive.CheckboxItem
      className={cn(itemClassName, 'mfc:pl-8', className)}
      data-mf-component=""
      data-slot="context-menu-checkbox-item"
      {...props}
      style={componentStyle}
    >
      <span className="mfc:absolute mfc:left-2 mfc:flex mfc:size-3.5 mfc:items-center mfc:justify-center">
        <ContextMenuPrimitive.ItemIndicator
          data-mf-component=""
          data-slot="context-menu-item-indicator"
        >
          <CheckIcon aria-hidden="true" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

export function ContextMenuRadioGroup(
  props: ComponentProps<typeof ContextMenuPrimitive.RadioGroup>,
) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <ContextMenuPrimitive.RadioGroup
      data-mf-component=""
      data-slot="context-menu-radio-group"
      {...props}
      style={componentStyle}
    />
  );
}

export function ContextMenuRadioItem({
  children,
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(itemClassName, 'mfc:pl-8', className)}
      data-mf-component=""
      data-slot="context-menu-radio-item"
      {...props}
      style={componentStyle}
    >
      <span className="mfc:absolute mfc:left-2 mfc:flex mfc:size-3.5 mfc:items-center mfc:justify-center">
        <ContextMenuPrimitive.ItemIndicator
          data-mf-component=""
          data-slot="context-menu-item-indicator"
        >
          <CircleIcon className="mfc:size-2 mfc:fill-current" aria-hidden="true" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <ContextMenuPrimitive.Separator
      className={cn('mfc:-mx-1 mfc:my-1 mfc:h-px mfc:bg-control-border', className)}
      data-mf-component=""
      data-slot="context-menu-separator"
      {...props}
      style={componentStyle}
    />
  );
}

export function ContextMenuSub(props: ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub {...props} />;
}

export function ContextMenuSubTrigger({
  children,
  className,
  inset,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & { inset?: boolean }) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <ContextMenuPrimitive.SubTrigger
      className={cn(itemClassName, inset && 'mfc:pl-8', className)}
      data-inset={inset ? '' : undefined}
      data-mf-component=""
      data-slot="context-menu-sub-trigger"
      {...props}
      style={componentStyle}
    >
      {children}
      <ChevronRightIcon className="mfc:ml-auto" aria-hidden="true" />
    </ContextMenuPrimitive.SubTrigger>
  );
}

export type ContextMenuSubContentProps = ComponentProps<typeof ContextMenuPrimitive.SubContent> & {
  container?: ComponentProps<typeof ContextMenuPrimitive.Portal>['container'];
};

export function ContextMenuSubContent({
  className,
  collisionPadding = 8,
  container,
  sideOffset = 4,
  ...props
}: ContextMenuSubContentProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <ContextMenuPortal container={container}>
      <ContextMenuPrimitive.SubContent
        className={cn(contentClassName, className)}
        collisionPadding={collisionPadding}
        data-mf-portal=""
        data-mf-component=""
        data-slot="context-menu-sub-content"
        sideOffset={sideOffset}
        {...props}
        style={componentStyle}
      />
    </ContextMenuPortal>
  );
}

export function ContextMenuShortcut({ className, ...props }: ComponentProps<'span'>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <span
      className={cn(
        'mfc:ml-auto mfc:pl-4 mfc:text-ui-caption mfc:tracking-[var(--mf-ui-tracking-caption,0)] mfc:text-content-muted',
        className,
      )}
      data-mf-component=""
      data-slot="context-menu-shortcut"
      {...props}
      style={componentStyle}
    />
  );
}

export const ContextMenu = Object.assign(ContextMenuRoot, {
  Root: ContextMenuRoot,
  Trigger: ContextMenuTrigger,
  Portal: ContextMenuPortal,
  Content: ContextMenuContent,
  Group: ContextMenuGroup,
  Label: ContextMenuLabel,
  Item: ContextMenuItem,
  CheckboxItem: ContextMenuCheckboxItem,
  RadioGroup: ContextMenuRadioGroup,
  RadioItem: ContextMenuRadioItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  Shortcut: ContextMenuShortcut,
});
