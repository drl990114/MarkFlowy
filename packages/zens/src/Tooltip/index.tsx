import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { isValidElement, type ComponentProps, type ReactNode } from 'react';
import styled from 'styled-components';

type TooltipSide = NonNullable<ComponentProps<typeof TooltipPrimitive.Content>['side']>;

export type TooltipOptions = {
  children: ReactNode;
  title: ReactNode;
  fixed?: boolean;
  placement?: TooltipSide | `${TooltipSide}-start` | `${TooltipSide}-end`;
};

export type TooltipProps = TooltipOptions &
  Omit<ComponentProps<typeof TooltipPrimitive.Content>, 'children' | 'title'> &
  Pick<ComponentProps<typeof TooltipPrimitive.Root>, 'open' | 'defaultOpen' | 'onOpenChange'> & {
    container?: ComponentProps<typeof TooltipPrimitive.Portal>['container'];
    showTimeout?: number;
    skipTimeout?: number;
  };

const TooltipContent = styled(TooltipPrimitive.Content)`
  z-index: var(--mf-layer-tooltip, 1001);
  border-radius: 0.375rem;
  border: 1px solid var(--mf-control-border, ${(props) => props.theme.borderColor});
  background-color: var(--mf-surface-tooltip, ${(props) => props.theme.tooltipBgColor});
  padding: 0.25rem 0.5rem;
  font-size: var(--mf-ui-font-caption, ${(props) => props.theme.fontXs});
  line-height: var(--mf-ui-line-height-caption, 1.25rem);
  letter-spacing: var(--mf-ui-tracking-caption, normal);
  color: var(--mf-text-primary, ${(props) => props.theme.primaryFontColor});
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
`;

const DisabledTrigger = styled.span`
  display: inline-flex;

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: 2px;
  }
`;

/** Compatibility API for shared components; all tooltip behavior is owned by Radix. */
const Tooltip = ({
  children,
  title,
  fixed = false,
  placement = fixed ? 'top' : 'bottom',
  open,
  defaultOpen,
  onOpenChange,
  container,
  showTimeout = 100,
  skipTimeout = 0,
  sideOffset = 5,
  ...contentProps
}: TooltipProps) => {
  if (!title) return children;

  const [side, alignment] = placement.split('-') as [TooltipSide, 'start' | 'end' | undefined];
  const child = isValidElement<{ disabled?: boolean }>(children) && children.props.disabled ? (
    <DisabledTrigger tabIndex={0} aria-label={typeof title === 'string' ? title : undefined}>
      {children}
    </DisabledTrigger>
  ) : children;

  return (
    <TooltipPrimitive.Provider delayDuration={showTimeout} skipDelayDuration={skipTimeout}>
      <TooltipPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        <TooltipPrimitive.Trigger asChild tabIndex={0} type={undefined}>
          {child}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal container={container}>
          <TooltipContent
            data-slot='tooltip-content'
            data-mf-portal=''
            side={side}
            align={alignment ?? 'center'}
            sideOffset={sideOffset}
            {...contentProps}
          >
            {title}
          </TooltipContent>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
};

export default Tooltip;
