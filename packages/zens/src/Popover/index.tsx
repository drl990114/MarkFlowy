import { Popover as Primitive } from 'radix-ui';
import { useId, type ComponentProps, type HTMLAttributes, type ReactNode } from 'react';
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  type PopoverContentProps,
} from '../components/popover';

export type PopoverPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';
export interface PopoverProps extends Omit<PopoverContentProps, 'title' | 'children'> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: ComponentProps<typeof PopoverRoot>['onOpenChange'];
  boxProps?: HTMLAttributes<HTMLDivElement>;
  arrow?: boolean;
  title?: string;
  customContent?: ReactNode;
  toggleOnClick?: boolean;
  placement?: PopoverPlacement;
  children?: ReactNode;
}
export default function Popover({
  open,
  defaultOpen,
  onOpenChange,
  boxProps,
  arrow = true,
  title,
  customContent,
  toggleOnClick = true,
  placement = 'bottom',
  children,
  ...props
}: PopoverProps) {
  const titleId = useId();
  const [side, align = 'center'] = placement.split('-') as [
    NonNullable<PopoverContentProps['side']>,
    NonNullable<PopoverContentProps['align']>,
  ];
  return (
    <PopoverRoot open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger
        asChild
        onClick={(event) => {
          if (!toggleOnClick) event.preventDefault();
        }}
      >
        <div
          role="button"
          tabIndex={0}
          {...boxProps}
          style={{ display: 'inline-block', ...boxProps?.style }}
          onKeyDown={(event) => {
            boxProps?.onKeyDown?.(event);
            if (
              !event.defaultPrevented &&
              event.target === event.currentTarget &&
              (event.key === 'Enter' || event.key === ' ')
            ) {
              event.preventDefault();
              event.currentTarget.click();
            }
          }}
        >
          {children}
        </div>
      </PopoverTrigger>
      {(customContent || title) && (
        <PopoverContent
          {...props}
          side={side}
          align={align}
          aria-labelledby={title ? titleId : undefined}
        >
          {arrow && <Primitive.Arrow className="mfc:fill-surface-overlay" />}
          {title && (
            <h3 id={titleId} className="mfc:mb-1 mfc:text-ui-control mfc:font-semibold">
              {title}
            </h3>
          )}
          {customContent}
        </PopoverContent>
      )}
    </PopoverRoot>
  );
}
