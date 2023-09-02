import type { TooltipProps } from '@mui/material'
import { Tooltip } from '@mui/material'
import classNames from 'classnames'

interface MfIconButtonProps {
  icon: string
  onClick: () => void
  tooltipProps?: Omit<TooltipProps, 'children'>
}

export const MfIconButton = (props: MfIconButtonProps) => {
  const { icon, onClick, tooltipProps } = props

  const iconCls = classNames('icon', icon)

  if (tooltipProps) {
    return (
      <Tooltip arrow {...tooltipProps}>
        <i className={iconCls} onClick={onClick}></i>
      </Tooltip>
    )
  }

  return <i className={iconCls} onClick={onClick}></i>
}
