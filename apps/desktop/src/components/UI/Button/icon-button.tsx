import type { TooltipProps } from 'zens'
import { Tooltip } from 'zens'
import classNames from 'classnames'

interface MfIconButtonProps {
  icon: string
  onClick: () => void
  iconRef?: React.RefObject<any>
  active?: boolean
  tooltipProps?: Omit<TooltipProps, 'children'>
}

export const MfIconButton = (props: MfIconButtonProps) => {
  const { icon, onClick, tooltipProps, iconRef } = props

  const iconCls = classNames('icon', icon, {
    'icon--active': props.active,
  })

  if (tooltipProps) {
    return (
      <Tooltip {...tooltipProps}>
        <i ref={iconRef} className={iconCls} onClick={onClick}></i>
      </Tooltip>
    )
  }

  return <i ref={iconRef} className={iconCls} onClick={onClick}></i>
}
