import { Select as SelectPrimitive } from 'radix-ui'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function SelectRoot(props: ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root {...props} />
}

export function SelectGroup(props: ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot='select-group' {...props} />
}

export function SelectValue(props: ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot='select-value' {...props} />
}

export type SelectTriggerProps = Omit<ComponentProps<typeof SelectPrimitive.Trigger>, 'size'> & {
  size?: 'sm' | 'default'
}

export function SelectTrigger({
  children,
  className,
  size = 'default',
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex min-w-0 items-center justify-between gap-2 rounded-md border border-control-border bg-surface-app px-2.5 text-ui-control text-content-primary shadow-sm outline-none transition-[color,box-shadow,border-color] duration-[var(--mf-motion-duration-fast)] ease-[var(--mf-motion-ease-out)] focus-visible:border-control-focus focus-visible:ring-2 focus-visible:ring-control-focus/25 disabled:pointer-events-none disabled:text-content-disabled disabled:opacity-60 motion-reduce:transition-none data-[placeholder]:text-content-muted [&>span]:truncate [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
        size === 'sm' ? 'h-7' : 'h-8',
        className,
      )}
      data-size={size}
      data-slot='select-trigger'
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon aria-hidden='true' />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export type SelectContentProps = ComponentProps<typeof SelectPrimitive.Content> & {
  container?: ComponentProps<typeof SelectPrimitive.Portal>['container']
}

export function SelectContent({
  children,
  className,
  container,
  position = 'popper',
  sideOffset = 4,
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Content
        className={cn(
          'relative z-[var(--mf-layer-select)] max-h-[var(--radix-select-content-available-height)] min-w-[8rem] overflow-hidden rounded-md border border-control-border bg-surface-overlay text-content-primary shadow-lg outline-none',
          position === 'popper' &&
            'min-w-[var(--radix-select-trigger-width)] data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          className,
        )}
        data-mf-portal=''
        data-slot='select-content'
        position={position}
        sideOffset={sideOffset}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn('p-1', position === 'popper' && 'w-full')}
          data-slot='select-viewport'
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn('px-2 py-1.5 text-xs font-medium text-content-muted', className)}
      data-slot='select-label'
      {...props}
    />
  )
}

export function SelectItem({
  children,
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-ui-control outline-none data-[disabled]:pointer-events-none data-[disabled]:text-content-disabled data-[highlighted]:bg-control-hover data-[highlighted]:text-content-primary',
        className,
      )}
      data-slot='select-item'
      {...props}
    >
      <span className='absolute right-2 flex size-3.5 items-center justify-center'>
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className='size-3.5' aria-hidden='true' />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-control-border', className)}
      data-slot='select-separator'
      {...props}
    />
  )
}

export function SelectScrollUpButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn('flex cursor-default items-center justify-center py-1 text-content-muted', className)}
      data-slot='select-scroll-up-button'
      {...props}
    >
      <ChevronUpIcon className='size-3.5' aria-hidden='true' />
    </SelectPrimitive.ScrollUpButton>
  )
}

export function SelectScrollDownButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn('flex cursor-default items-center justify-center py-1 text-content-muted', className)}
      data-slot='select-scroll-down-button'
      {...props}
    >
      <ChevronDownIcon className='size-3.5' aria-hidden='true' />
    </SelectPrimitive.ScrollDownButton>
  )
}

export const Select = Object.assign(SelectRoot, {
  Root: SelectRoot,
  Group: SelectGroup,
  Value: SelectValue,
  Trigger: SelectTrigger,
  Content: SelectContent,
  Label: SelectLabel,
  Item: SelectItem,
  Separator: SelectSeparator,
  ScrollUpButton: SelectScrollUpButton,
  ScrollDownButton: SelectScrollDownButton,
})
