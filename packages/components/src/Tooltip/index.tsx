import type { TooltipProviderProps } from '@ariakit/react'
import { TooltipProvider, Tooltip as AkTooltip, TooltipAnchor } from '@ariakit/react'
import styled from 'styled-components'

interface TooltipProps extends BaseComponentProps, TooltipProviderProps {
  title: string
  children: React.ReactElement
}

const TooltipWrapper = styled(AkTooltip)`
  z-index: 90;
  cursor: default;
  border-radius: 0.375rem;
  border-width: 1px;
  border-color: ${props => props.theme.borderColor};
  background-color: ${props => props.theme.tooltipBgColor};
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: ${props => props.theme.primaryFontColor};
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
`
const Tooltip: React.FC<TooltipProps> = (props) => {
  const { title, children, placement } = props

  return (
    <TooltipProvider placement={placement}>
      <TooltipAnchor render={children}></TooltipAnchor>
      <TooltipWrapper>{title}</TooltipWrapper>
    </TooltipProvider>
  )
}

export default Tooltip
