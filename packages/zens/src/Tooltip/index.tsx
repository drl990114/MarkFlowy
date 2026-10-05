import { isValidElement, type ComponentProps, type ReactNode } from 'react'
import {
  Tooltip as ComponentTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type TooltipContentProps,
} from '../components/tooltip'

type TooltipSide = NonNullable<TooltipContentProps['side']>
export type TooltipOptions = {
  children: ReactNode
  title: ReactNode
  fixed?: boolean
  placement?: TooltipSide | `${TooltipSide}-start` | `${TooltipSide}-end`
}

export type TooltipProps = TooltipOptions &
  Omit<TooltipContentProps, 'children' | 'title'> &
  Pick<ComponentProps<typeof ComponentTooltip>, 'open' | 'defaultOpen' | 'onOpenChange'> & {
    showTimeout?: number
    skipTimeout?: number
  }

/** Compatibility names only; the shared Radix primitive owns all tooltip behavior. */
export default function Tooltip({
  children,
  title,
  fixed = false,
  placement = fixed ? 'top' : 'bottom',
  open,
  defaultOpen,
  onOpenChange,
  showTimeout = 100,
  skipTimeout = 0,
  ...contentProps
}: TooltipProps) {
  if (!title) return children

  const [side, alignment] = placement.split('-') as [TooltipSide, 'start' | 'end' | undefined]
  const child =
    isValidElement<{ disabled?: boolean }>(children) && children.props.disabled ? (
      <span
        className='mfc:inline-flex mfc:focus-visible:outline-2 mfc:focus-visible:outline-ring mfc:focus-visible:outline-offset-2'
        tabIndex={0}
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {children}
      </span>
    ) : (
      children
    )

  return (
    <TooltipProvider delayDuration={showTimeout} skipDelayDuration={skipTimeout}>
      <ComponentTooltip open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        <TooltipTrigger asChild tabIndex={0} type={undefined}>
          {child}
        </TooltipTrigger>
        <TooltipContent side={side} align={alignment ?? 'center'} {...contentProps}>
          {title}
        </TooltipContent>
      </ComponentTooltip>
    </TooltipProvider>
  )
}
