import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { TooltipContentProps } from '@/components/ui/tooltip'
import classNames from 'classnames'
import type { ReactNode } from 'react'

type MfTooltipProps = Omit<TooltipContentProps, 'children'> & {
  title: ReactNode
}

interface MfIconButtonBaseProps {
  active?: boolean
  className?: string
  disabled?: boolean
  icon: string
  iconRef?: React.RefObject<any>
  onClick: (event?: React.MouseEvent<HTMLElement>) => void
  rounded?: 'smooth' | 'rounded' | 'square'
  size?: 'small' | 'medium' | 'large'
  tooltipProps?: MfTooltipProps
  unselected?: boolean
}

type MfIconButtonAccessibleName =
  | { ariaLabel: string; tooltipProps?: MfTooltipProps }
  | { ariaLabel?: undefined; tooltipProps: MfTooltipProps & { title: string } }

export type MfIconButtonProps = MfIconButtonBaseProps & MfIconButtonAccessibleName

/** Compatibility adapter for legacy callers. New code should use the Desktop Button facade. */
export function MfIconButton(props: MfIconButtonProps) {
  const {
    disabled = false,
    icon,
    iconRef,
    onClick,
    rounded = 'square',
    tooltipProps,
    unselected = false,
  } = props

  const buttonClassName = classNames('icon', props.className, {
    'icon--active': props.active,
    [`icon-${props.size || 'medium'}`]: true,
    'icon-rounded': rounded === 'rounded',
    'icon-smooth': rounded === 'smooth',
    'icon-square': rounded === 'square',
    'icon-unselected': unselected,
    'icon-disabled': disabled,
  })
  const accessibleName = props.ariaLabel ?? tooltipProps?.title
  const content = (
    <Button
      ref={iconRef}
      aria-label={accessibleName}
      aria-pressed={typeof props.active === 'boolean' ? props.active : undefined}
      className={buttonClassName}
      disabled={disabled}
      onClick={(event) => onClick(event)}
      size='icon-sm'
      variant='ghost'
    >
      <i aria-hidden='true' className={icon} />
    </Button>
  )

  if (!tooltipProps?.title) return content

  const { title, ...contentProps } = tooltipProps
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent {...contentProps}>{title}</TooltipContent>
    </Tooltip>
  )
}
