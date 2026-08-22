import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { TooltipContentProps } from '@/components/ui/tooltip'
import classNames from 'classnames'
import type { ReactNode } from 'react'
import styled from 'styled-components'

type MfTooltipProps = Omit<TooltipContentProps, 'children'> & {
  title: ReactNode
}

interface MfIconLabelButtonBaseProps {
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

type MfIconLabelButtonAccessibleName =
  | { ariaLabel?: string; label: string; tooltipProps?: MfTooltipProps }
  | { ariaLabel: string; label?: undefined; tooltipProps?: MfTooltipProps }
  | {
      ariaLabel?: undefined
      label?: undefined
      tooltipProps: MfTooltipProps & { title: string }
    }

export type MfIconLabelButtonProps = MfIconLabelButtonBaseProps &
  MfIconLabelButtonAccessibleName

const Wrapper = styled(Button)`
  height: auto;
  padding: 4px;
  border: 0;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  background: transparent;
  color: inherit;
  font-size: ${(props) => props.theme.fontXs};

  &:hover {
    color: var(--mf-text-primary, ${(props) => props.theme.primaryFontColor});
    background-color: var(--mf-control-ghost-hover, ${(props) => props.theme.hoverColor});
  }

  .btn-icon {
    font-size: 1rem;
  }
`

/** Compatibility adapter for legacy callers. New code should use the Desktop Button facade. */
export function MfIconLabelButton(props: MfIconLabelButtonProps) {
  const { ariaLabel, disabled = false, icon, iconRef, label, onClick, tooltipProps } = props
  const iconClassName = classNames('btn-icon', icon)
  const accessibleName =
    ariaLabel ??
    label ??
    (typeof tooltipProps?.title === 'string' ? tooltipProps.title : undefined)

  const content = (
    <Wrapper
      ref={iconRef}
      aria-label={accessibleName}
      aria-pressed={typeof props.active === 'boolean' ? props.active : undefined}
      className={props.className}
      disabled={disabled}
      onClick={(event) => onClick(event)}
      variant='ghost'
    >
      <i aria-hidden='true' className={iconClassName} />
      {label ? <span className='icon-label'>{label}</span> : null}
    </Wrapper>
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
