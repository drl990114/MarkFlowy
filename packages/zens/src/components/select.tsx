import { useComponentThemeStyle } from '../Theme/components-theme';
import { Select as SelectPrimitive } from 'radix-ui';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';
import { focusFeedback } from './focus-styles';

export function SelectRoot(props: ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root {...props} />;
}

export function SelectGroup(props: ComponentProps<typeof SelectPrimitive.Group>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <SelectPrimitive.Group
      data-mf-component=""
      data-slot="select-group"
      {...props}
      style={componentStyle}
    />
  );
}

export function SelectValue(props: ComponentProps<typeof SelectPrimitive.Value>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <SelectPrimitive.Value
      data-mf-component=""
      data-slot="select-value"
      {...props}
      style={componentStyle}
    />
  );
}

export type SelectTriggerProps = Omit<ComponentProps<typeof SelectPrimitive.Trigger>, 'size'> & {
  size?: 'sm' | 'default';
};

export function SelectTrigger({
  children,
  className,
  size = 'default',
  ...props
}: SelectTriggerProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <SelectPrimitive.Trigger
      className={cn(
        focusFeedback,
        'mfc:flex mfc:min-w-0 mfc:items-center mfc:justify-between mfc:gap-2 mfc:rounded-sm mfc:border mfc:border-control-border mfc:bg-surface-app mfc:px-2.5 mfc:text-ui-control mfc:text-content-primary mfc:outline-none mfc:transition-[color,background-color,box-shadow,border-color] mfc:duration-[var(--mf-motion-duration-fast,100ms)] mfc:ease-[var(--mf-motion-ease-out,cubic-bezier(0.23,_1,_0.32,_1))] mfc:hover:bg-control-hover mfc:active:bg-control-pressed mfc:disabled:pointer-events-none mfc:disabled:text-content-disabled mfc:disabled:opacity-60 mfc:motion-reduce:transition-none mfc:data-[placeholder]:text-content-muted mfc:[&>span]:truncate mfc:[&_svg]:pointer-events-none mfc:[&_svg]:size-3.5 mfc:[&_svg]:shrink-0',
        size === 'sm' ? 'mfc:h-7' : 'mfc:h-8',
        className,
      )}
      data-size={size}
      data-mf-component=""
      data-slot="select-trigger"
      {...props}
      style={componentStyle}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export type SelectContentProps = ComponentProps<typeof SelectPrimitive.Content> & {
  container?: ComponentProps<typeof SelectPrimitive.Portal>['container'];
};

export function SelectContent({
  children,
  className,
  container,
  position = 'popper',
  sideOffset = 4,
  ...props
}: SelectContentProps) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Content
        className={cn(
          'mfc:relative mfc:z-[var(--mf-layer-select,1000)] mfc:max-h-[var(--radix-select-content-available-height)] mfc:min-w-[8rem] mfc:overflow-hidden mfc:rounded-lg mfc:border mfc:border-control-border mfc:bg-surface-overlay mfc:text-content-primary mfc:shadow-lg mfc:outline-none',
          position === 'popper' && 'mfc:min-w-[var(--radix-select-trigger-width)]',
          className,
        )}
        data-mf-portal=""
        data-mf-component=""
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        {...props}
        style={componentStyle}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn('mfc:p-1', position === 'popper' && 'mfc:w-full')}
          data-mf-component=""
          data-slot="select-viewport"
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <SelectPrimitive.Label
      className={cn(
        'mfc:px-2 mfc:py-1.5 mfc:text-xs mfc:font-medium mfc:text-content-muted',
        className,
      )}
      data-mf-component=""
      data-slot="select-label"
      {...props}
      style={componentStyle}
    />
  );
}

export function SelectItem({
  children,
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <SelectPrimitive.Item
      className={cn(
        'mfc:relative mfc:flex mfc:min-h-7 mfc:w-full mfc:cursor-default mfc:select-none mfc:items-center mfc:rounded-sm mfc:py-1 mfc:pr-8 mfc:pl-2 mfc:text-ui-control mfc:outline-none mfc:data-[disabled]:pointer-events-none mfc:data-[disabled]:text-content-disabled mfc:data-[highlighted]:bg-control-hover mfc:data-[highlighted]:text-content-primary',
        className,
      )}
      data-mf-component=""
      data-slot="select-item"
      {...props}
      style={componentStyle}
    >
      <span className="mfc:absolute mfc:right-2 mfc:flex mfc:size-3.5 mfc:items-center mfc:justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="mfc:size-3.5" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <SelectPrimitive.Separator
      className={cn('mfc:-mx-1 mfc:my-1 mfc:h-px mfc:bg-control-border', className)}
      data-mf-component=""
      data-slot="select-separator"
      {...props}
      style={componentStyle}
    />
  );
}

export function SelectScrollUpButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <SelectPrimitive.ScrollUpButton
      className={cn(
        'mfc:flex mfc:cursor-default mfc:items-center mfc:justify-center mfc:py-1 mfc:text-content-muted',
        className,
      )}
      data-mf-component=""
      data-slot="select-scroll-up-button"
      {...props}
      style={componentStyle}
    >
      <ChevronUpIcon className="mfc:size-3.5" aria-hidden="true" />
    </SelectPrimitive.ScrollUpButton>
  );
}

export function SelectScrollDownButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  const componentStyle = useComponentThemeStyle(props.style);

  return (
    <SelectPrimitive.ScrollDownButton
      className={cn(
        'mfc:flex mfc:cursor-default mfc:items-center mfc:justify-center mfc:py-1 mfc:text-content-muted',
        className,
      )}
      data-mf-component=""
      data-slot="select-scroll-down-button"
      {...props}
      style={componentStyle}
    >
      <ChevronDownIcon className="mfc:size-3.5" aria-hidden="true" />
    </SelectPrimitive.ScrollDownButton>
  );
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
});
