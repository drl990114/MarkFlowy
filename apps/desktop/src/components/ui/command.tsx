import { Command as CommandPrimitive } from 'cmdk'
import { SearchIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function CommandRoot({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        'flex h-full w-full flex-col overflow-hidden bg-popover text-popover-foreground',
        className,
      )}
      data-slot='command'
      {...props}
    />
  )
}

export function CommandInput({
  className,
  wrapperClassName,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input> & { wrapperClassName?: string }) {
  return (
    <div
      className={cn('flex items-center gap-2 border-b border-border px-2.5', wrapperClassName)}
      data-slot='command-input-wrapper'
    >
      <SearchIcon className='size-3.5 shrink-0 text-muted-foreground' aria-hidden='true' />
      <CommandPrimitive.Input
        className={cn(
          'h-8 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground disabled:opacity-50',
          className,
        )}
        data-slot='command-input'
        {...props}
      />
    </div>
  )
}

export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn('max-h-56 overflow-x-hidden overflow-y-auto p-1', className)}
      data-slot='command-list'
      {...props}
    />
  )
}

export function CommandEmpty({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn('px-3 py-4 text-center text-xs text-muted-foreground', className)}
      data-slot='command-empty'
      {...props}
    />
  )
}

export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        'overflow-hidden p-0.5 text-foreground [&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:px-1.5 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-normal [&_[cmdk-group-heading]]:text-muted-foreground',
        className,
      )}
      data-slot='command-group'
      {...props}
    />
  )
}

export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'relative flex min-h-7 cursor-default select-none items-center rounded-md px-2 py-1.5 text-xs outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:text-disabled-foreground data-[selected=true]:bg-primary-soft data-[selected=true]:text-foreground',
        className,
      )}
      data-slot='command-item'
      {...props}
    />
  )
}

export function CommandSeparator({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      data-slot='command-separator'
      {...props}
    />
  )
}

export const Command = Object.assign(CommandRoot, {
  Root: CommandRoot,
  Input: CommandInput,
  List: CommandList,
  Empty: CommandEmpty,
  Group: CommandGroup,
  Item: CommandItem,
  Separator: CommandSeparator,
})
