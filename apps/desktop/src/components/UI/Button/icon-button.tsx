import type { TooltipProps} from '@markflowy/components'
import { Tooltip } from '@markflowy/components'
import classNames from 'classnames'

interface MfIconButtonProps {
  icon: string
  onClick: () => void
  active?: boolean
  tooltipProps?: Omit<TooltipProps, 'children'>
}

export const MfIconButton = (props: MfIconButtonProps) => {
  const { icon, onClick, tooltipProps } = props

  const iconCls = classNames('icon', icon, {
    'icon--active': props.active,
  })

  if (tooltipProps) {
    return (
      <Tooltip {...tooltipProps}>
        <i className={iconCls} onClick={onClick}></i>
      </Tooltip>
    )
  }

  return <i className={iconCls} onClick={onClick}></i>
}
