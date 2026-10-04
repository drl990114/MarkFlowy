import { useComponentThemeStyle } from '../Theme/components-theme';
import { Command as CommandPrimitive } from 'cmdk';
import { SearchIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

export function CommandRoot({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <CommandPrimitive
      className={cn(
        'mfc:flex mfc:h-full mfc:w-full mfc:flex-col mfc:overflow-hidden mfc:bg-popover mfc:text-popover-foreground',
        className,
      )}
      data-mf-component=""
      data-slot="command"
      {...props}
      style={componentStyle}
    />
  );
}

export function CommandInput({
  className,
  wrapperClassName,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input> & { wrapperClassName?: string }) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <div
      className={cn(
        'mfc:flex mfc:items-center mfc:gap-2 mfc:border-b mfc:border-border mfc:px-2.5 mfc:has-[:focus-visible]:border-control-focus',
        wrapperClassName,
      )}
      data-mf-component=""
      data-slot="command-input-wrapper"
    >
      <SearchIcon
        className="mfc:size-3.5 mfc:shrink-0 mfc:text-muted-foreground"
        aria-hidden="true"
      />
      <CommandPrimitive.Input
        className={cn(
          'mfc:h-8 mfc:w-full mfc:bg-transparent mfc:text-ui-control mfc:outline-none mfc:placeholder:text-muted-foreground mfc:disabled:opacity-50',
          className,
        )}
        data-mf-component=""
        data-slot="command-input"
        {...props}
        style={componentStyle}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <CommandPrimitive.List
      className={cn(
        'mfc:max-h-56 mfc:scroll-py-1 mfc:overflow-x-hidden mfc:overflow-y-auto mfc:overscroll-contain mfc:p-1',
        className,
      )}
      data-mf-component=""
      data-slot="command-list"
      {...props}
      style={componentStyle}
    />
  );
}

export function CommandEmpty({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <CommandPrimitive.Empty
      className={cn(
        'mfc:px-3 mfc:py-4 mfc:text-center mfc:text-xs mfc:text-muted-foreground',
        className,
      )}
      data-mf-component=""
      data-slot="command-empty"
      {...props}
      style={componentStyle}
    />
  );
}

export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <CommandPrimitive.Group
      className={cn(
        'mfc:overflow-hidden mfc:p-0.5 mfc:text-foreground mfc:[&_[cmdk-group-heading]]:flex mfc:[&_[cmdk-group-heading]]:items-center mfc:[&_[cmdk-group-heading]]:px-1.5 mfc:[&_[cmdk-group-heading]]:py-1 mfc:[&_[cmdk-group-heading]]:text-ui-caption mfc:[&_[cmdk-group-heading]]:font-normal mfc:[&_[cmdk-group-heading]]:text-muted-foreground',
        className,
      )}
      data-mf-component=""
      data-slot="command-group"
      {...props}
      style={componentStyle}
    />
  );
}

export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <CommandPrimitive.Item
      className={cn(
        'mfc:relative mfc:flex mfc:min-h-7 mfc:cursor-default mfc:select-none mfc:items-center mfc:gap-2 mfc:rounded-sm mfc:px-2 mfc:py-1 mfc:text-ui-control mfc:outline-none mfc:data-[disabled=true]:pointer-events-none mfc:data-[disabled=true]:text-disabled-foreground mfc:data-[selected=true]:bg-control-selected mfc:data-[selected=true]:text-foreground',
        className,
      )}
      data-mf-component=""
      data-slot="command-item"
      {...props}
      style={componentStyle}
    />
  );
}

export function CommandSeparator({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <CommandPrimitive.Separator
      className={cn('mfc:-mx-1 mfc:my-1 mfc:h-px mfc:bg-border', className)}
      data-mf-component=""
      data-slot="command-separator"
      {...props}
      style={componentStyle}
    />
  );
}

export const Command = Object.assign(CommandRoot, {
  Root: CommandRoot,
  Input: CommandInput,
  List: CommandList,
  Empty: CommandEmpty,
  Group: CommandGroup,
  Item: CommandItem,
  Separator: CommandSeparator,
});
