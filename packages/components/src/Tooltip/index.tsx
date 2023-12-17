import React, { forwardRef } from 'react'
import * as Ariakit from '@ariakit/react'
import { Box } from '../Box'
import styled from 'styled-components'
import * as S from './styles'

export type TooltipOptions = {
  children: React.ReactNode
  title: BaseComponentProps['children']
  fixed?: boolean
} & Pick<Ariakit.TooltipStoreProps, 'placement'>

export interface TooltipProps
  extends BaseComponentProps,
    TooltipOptions,
    Ariakit.TooltipProviderProps {
  title: string
  children: BaseComponentProps['children']
}

const TooltipWrapper = styled.div`
  border-radius: 0.375rem;
  border-width: 1px;
  border-color: ${(props) => props.theme.borderColor};
  background-color: ${(props) => props.theme.tooltipBgColor};
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  font-size: ${(props) => props.theme.fontXs};
  line-height: 1.25rem;
  color: ${(props) => props.theme.primaryFontColor};
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
`

const Tooltip = forwardRef<any, TooltipProps>(
  ({ children, title, fixed = false, placement = fixed ? 'top' : 'bottom', ...rest }, ref) => {
    const child = (children as JSX.Element)?.props?.disabled
      ? React.Children.only(<S.ChildItem>{children}</S.ChildItem>)
      : children

    // If no content, simply return the children
    if (!title) {
      return children as React.ReactElement
    }

    return (
      <Ariakit.TooltipProvider placement={placement}>
        <Ariakit.TooltipAnchor render={child} />
        <Ariakit.Tooltip ref={ref} render={<Box style={{ zIndex: 99 }} {...rest} />}>
          <TooltipWrapper>{title}</TooltipWrapper>
        </Ariakit.Tooltip>
      </Ariakit.TooltipProvider>
    )
  },
)

export default Tooltip
