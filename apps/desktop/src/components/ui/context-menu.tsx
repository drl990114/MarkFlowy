import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react'
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function ContextMenuRoot(props: ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root {...props} />
}

export function ContextMenuTrigger(props: ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger data-slot='context-menu-trigger' {...props} />
}

export function ContextMenuPortal(props: ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return <ContextMenuPrimitive.Portal {...props} />
}

const contentClassName =
  'z-[var(--mf-layer-menu)] max-h-[var(--radix-context-menu-content-available-height)] min-w-36 origin-[var(--radix-context-menu-content-transform-origin)] overflow-x-hidden overflow-y-auto rounded-md border border-control-border bg-surface-overlay p-1 text-content-primary shadow-lg outline-none data-[state=open]:animate-[mf-surface-in_var(--mf-motion-duration-base)_var(--mf-motion-ease-out)_both] data-[state=closed]:animate-[mf-surface-out_var(--mf-motion-duration-fast)_var(--mf-motion-ease-in)_both] motion-reduce:data-[state=open]:animate-[mf-fade-in_var(--mf-motion-duration-fast)_var(--mf-motion-ease-out)_both] motion-reduce:data-[state=closed]:animate-[mf-fade-out_var(--mf-motion-duration-fast)_var(--mf-motion-ease-in)_both]'

export type ContextMenuContentProps = ComponentProps<typeof ContextMenuPrimitive.Content> & {
  container?: ComponentProps<typeof ContextMenuPrimitive.Portal>['container']
}

export function ContextMenuContent({
  className,
  collisionPadding = 8,
  container,
  ...props
}: ContextMenuContentProps) {
  return (
    <ContextMenuPortal container={container}>
      <ContextMenuPrimitive.Content
        className={cn(contentClassName, className)}
        collisionPadding={collisionPadding}
        data-mf-portal=''
        data-slot='context-menu-content'
        {...props}
      />
    </ContextMenuPortal>
  )
}

export function ContextMenuGroup(props: ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return <ContextMenuPrimitive.Group data-slot='context-menu-group' {...props} />
}

export function ContextMenuLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Label> & { inset?: boolean }) {
  return (
    <ContextMenuPrimitive.Label
      className={cn(
        'px-2 py-1.5 text-ui-caption font-medium tracking-[var(--mf-ui-tracking-caption)] text-content-muted',
        inset && 'pl-8',
        className,
      )}
      data-inset={inset ? '' : undefined}
      data-slot='context-menu-label'
      {...props}
    />
  )
}

const itemClassName =
  'relative flex min-h-7 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-ui-control tracking-[var(--mf-ui-tracking-control)] text-content-primary outline-none data-[disabled]:pointer-events-none data-[disabled]:text-content-disabled data-[disabled]:opacity-60 data-[highlighted]:bg-control-hover data-[highlighted]:text-content-primary [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0'

export function ContextMenuItem({
  className,
  inset,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Item> & { inset?: boolean }) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(itemClassName, inset && 'pl-8', className)}
      data-inset={inset ? '' : undefined}
      data-slot='context-menu-item'
      {...props}
    />
  )
}

export function ContextMenuCheckboxItem({
  children,
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      className={cn(itemClassName, 'pl-8', className)}
      data-slot='context-menu-checkbox-item'
      {...props}
    >
      <span className='absolute left-2 flex size-3.5 items-center justify-center'>
        <ContextMenuPrimitive.ItemIndicator data-slot='context-menu-item-indicator'>
          <CheckIcon aria-hidden='true' />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}

export function ContextMenuRadioGroup(
  props: ComponentProps<typeof ContextMenuPrimitive.RadioGroup>,
) {
  return <ContextMenuPrimitive.RadioGroup data-slot='context-menu-radio-group' {...props} />
}

export function ContextMenuRadioItem({
  children,
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(itemClassName, 'pl-8', className)}
      data-slot='context-menu-radio-item'
      {...props}
    >
      <span className='absolute left-2 flex size-3.5 items-center justify-center'>
        <ContextMenuPrimitive.ItemIndicator data-slot='context-menu-item-indicator'>
          <CircleIcon className='size-2 fill-current' aria-hidden='true' />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-control-border', className)}
      data-slot='context-menu-separator'
      {...props}
    />
  )
}

export function ContextMenuSub(props: ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub {...props} />
}

export function ContextMenuSubTrigger({
  children,
  className,
  inset,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & { inset?: boolean }) {
  return (
    <ContextMenuPrimitive.SubTrigger
      className={cn(itemClassName, inset && 'pl-8', className)}
      data-inset={inset ? '' : undefined}
      data-slot='context-menu-sub-trigger'
      {...props}
    >
      {children}
      <ChevronRightIcon className='ml-auto' aria-hidden='true' />
    </ContextMenuPrimitive.SubTrigger>
  )
}

export type ContextMenuSubContentProps = ComponentProps<typeof ContextMenuPrimitive.SubContent> & {
  container?: ComponentProps<typeof ContextMenuPrimitive.Portal>['container']
}

export function ContextMenuSubContent({
  className,
  collisionPadding = 8,
  container,
  sideOffset = 4,
  ...props
}: ContextMenuSubContentProps) {
  return (
    <ContextMenuPortal container={container}>
      <ContextMenuPrimitive.SubContent
        className={cn(contentClassName, className)}
        collisionPadding={collisionPadding}
        data-mf-portal=''
        data-slot='context-menu-sub-content'
        sideOffset={sideOffset}
        {...props}
      />
    </ContextMenuPortal>
  )
}

export function ContextMenuShortcut({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'ml-auto pl-4 text-ui-caption tracking-[var(--mf-ui-tracking-caption)] text-content-muted',
        className,
      )}
      data-slot='context-menu-shortcut'
      {...props}
    />
  )
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
})
