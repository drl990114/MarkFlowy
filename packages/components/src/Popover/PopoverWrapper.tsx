import { Popover as AkPopover } from '@ariakit/react'
import styled from 'styled-components'

export const PopoverWrapper = styled(AkPopover)`
  display: flex;
  max-width: min(calc(100vw - 16px), 320px);
  flex-direction: column;
  border-radius: ${props => props.theme.smallBorderRadius};
  border-width: 1px;
  border-style: solid;
  border-color: ${(props) => props.theme.borderColor};
  background-color: ${(props) => props.theme.bgColor};
  padding: ${props => props.theme.smallPadding};
  color: ${(props) => props.theme.primaryFontColor};
  outline: none;

  .arrow {
    stroke: ${(props) => props.theme.borderColor} !important;
    stroke-width: 4 !important;
  }
`
