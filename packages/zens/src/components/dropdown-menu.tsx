import { DropdownMenu as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { useComponentThemeStyle } from '../Theme/components-theme';

export const DropdownMenuRoot = Primitive.Root;
export function DropdownMenuTrigger({ style, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  const themeStyle = useComponentThemeStyle(style);
  return (
    <Primitive.Trigger
      {...props}
      style={themeStyle}
      data-slot="dropdown-menu-trigger"
      data-mf-component=""
    />
  );
}
export const DropdownMenuGroup = Primitive.Group;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;
export const DropdownMenuSub = Primitive.Sub;
export const DropdownMenuArrow = Primitive.Arrow;

const contentClass =
  'mfc:z-[var(--mf-layer-menu,1000)] mfc:max-h-[var(--radix-dropdown-menu-content-available-height)] mfc:min-w-36 mfc:overflow-y-auto mfc:rounded-lg mfc:border mfc:border-control-border mfc:bg-surface-overlay mfc:p-1 mfc:text-content-primary mfc:shadow-lg mfc:outline-none';
const itemClass =
  'mfc:relative mfc:flex mfc:min-h-7 mfc:cursor-default mfc:select-none mfc:items-center mfc:gap-2 mfc:rounded-sm mfc:px-2 mfc:py-1 mfc:text-ui-control mfc:outline-none mfc:data-[disabled]:pointer-events-none mfc:data-[disabled]:opacity-50 mfc:data-[highlighted]:bg-control-hover';
export type DropdownMenuContentProps = ComponentProps<typeof Primitive.Content> & {
  container?: ComponentProps<typeof Primitive.Portal>['container'];
};
export function DropdownMenuContent({
  container,
  className,
  style,
  collisionPadding = 8,
  ...props
}: DropdownMenuContentProps) {
  const themeStyle = useComponentThemeStyle(style);
  return (
    <Primitive.Portal container={container}>
      <Primitive.Content
        {...props}
        collisionPadding={collisionPadding}
        className={cn(contentClass, className)}
        style={themeStyle}
        data-slot="dropdown-menu-content"
        data-mf-component=""
        data-mf-portal=""
      />
    </Primitive.Portal>
  );
}
export function DropdownMenuItemPrimitive({
  className,
  style,
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  const themeStyle = useComponentThemeStyle(style);
  return (
    <Primitive.Item
      {...props}
      style={themeStyle}
      className={cn(itemClass, className)}
      data-slot="dropdown-menu-item"
      data-mf-component=""
    />
  );
}
export function DropdownMenuCheckboxItem({
  className,
  style,
  ...props
}: ComponentProps<typeof Primitive.CheckboxItem>) {
  const themeStyle = useComponentThemeStyle(style);
  return (
    <Primitive.CheckboxItem
      {...props}
      style={themeStyle}
      className={cn(itemClass, className)}
      data-slot="dropdown-menu-checkbox-item"
      data-mf-component=""
    />
  );
}
export function DropdownMenuRadioItem({
  className,
  style,
  ...props
}: ComponentProps<typeof Primitive.RadioItem>) {
  const themeStyle = useComponentThemeStyle(style);
  return (
    <Primitive.RadioItem
      {...props}
      style={themeStyle}
      className={cn(itemClass, className)}
      data-slot="dropdown-menu-radio-item"
      data-mf-component=""
    />
  );
}
export function DropdownMenuLabel({
  className,
  style,
  ...props
}: ComponentProps<typeof Primitive.Label>) {
  const themeStyle = useComponentThemeStyle(style);
  return (
    <Primitive.Label
      {...props}
      style={themeStyle}
      className={cn('mfc:px-2 mfc:py-1 mfc:text-content-muted mfc:text-ui-caption', className)}
      data-slot="dropdown-menu-label"
      data-mf-component=""
    />
  );
}
export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Primitive.Separator>) {
  return (
    <Primitive.Separator
      {...props}
      className={cn('mfc:my-1 mfc:h-px mfc:bg-control-border', className)}
      data-slot="dropdown-menu-separator"
    />
  );
}
export function DropdownMenuSubTrigger({
  children,
  className,
  style,
  ...props
}: ComponentProps<typeof Primitive.SubTrigger>) {
  const themeStyle = useComponentThemeStyle(style);
  return (
    <Primitive.SubTrigger
      {...props}
      className={cn(itemClass, className)}
      style={themeStyle}
      data-slot="dropdown-menu-sub-trigger"
      data-mf-component=""
    >
      {children}
      <span aria-hidden className="mfc:ml-auto">
        ›
      </span>
    </Primitive.SubTrigger>
  );
}
export type DropdownMenuSubContentProps = ComponentProps<typeof Primitive.SubContent> & {
  container?: ComponentProps<typeof Primitive.Portal>['container'];
};
export function DropdownMenuSubContent({
  container,
  className,
  style,
  collisionPadding = 8,
  sideOffset = 4,
  ...props
}: DropdownMenuSubContentProps) {
  const themeStyle = useComponentThemeStyle(style);
  return (
    <Primitive.Portal container={container}>
      <Primitive.SubContent
        {...props}
        collisionPadding={collisionPadding}
        sideOffset={sideOffset}
        className={cn(contentClass, className)}
        style={themeStyle}
        data-slot="dropdown-menu-sub-content"
        data-mf-component=""
        data-mf-portal=""
      />
    </Primitive.Portal>
  );
}
