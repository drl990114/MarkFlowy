import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { TooltipContentProps } from '@/components/ui/tooltip'
import classNames from 'classnames'
import type { ReactNode } from 'react'

type MfTooltipProps = Omit<TooltipContentProps, 'children'> & {
  title: ReactNode
}

interface MfIconButtonProps {
  icon: string
  className?: string
  onClick: (e?: React.MouseEvent<HTMLElement>) => void
  iconRef?: React.RefObject<any>
  active?: boolean
  tooltipProps?: MfTooltipProps
  disabled?: boolean
  unselected?: boolean
  size?: 'small' | 'medium' | 'large'
  rounded?: 'smooth' | 'rounded' | 'square'
}

export const MfIconButton = (props: MfIconButtonProps) => {
  const {
    icon,
    onClick,
    tooltipProps,
    iconRef,
    rounded = 'square',
    disabled = false,
    unselected = false,
  } = props

  const iconCls = classNames('icon', icon, props.className, {
    'icon--active': props.active,
    [`icon-${props.size || 'medium'}`]: true,
    'icon-rounded': rounded === 'rounded',
    'icon-smooth': rounded === 'smooth',
    'icon-square': rounded === 'square',
    'icon-unselected': unselected,
    'icon-disabled': disabled
  })

  if (tooltipProps) {
    const { title, ...contentProps } = tooltipProps

    if (!title) return <i ref={iconRef} className={iconCls} onClick={onClick}></i>

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <i ref={iconRef} className={iconCls} onClick={onClick}></i>
        </TooltipTrigger>
        <TooltipContent {...contentProps}>{title}</TooltipContent>
      </Tooltip>
    )
  }

  return <i ref={iconRef} className={iconCls} onClick={onClick}></i>
}
