import classNames from 'classnames'
import type { TooltipProps } from 'zens'
import { Tooltip } from 'zens'

interface MfIconButtonProps {
  icon: string
  className?: string
  onClick: (e?: React.MouseEvent<HTMLElement>) => void
  iconRef?: React.RefObject<any>
  active?: boolean
  tooltipProps?: Omit<TooltipProps, 'children'> & {
    style?: React.CSSProperties
  }
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
    return (
      <Tooltip style={{ zIndex: 11 }} {...tooltipProps}>
        <i ref={iconRef} className={iconCls} onClick={onClick}></i>
      </Tooltip>
    )
  }

  return <i ref={iconRef} className={iconCls} onClick={onClick}></i>
}
