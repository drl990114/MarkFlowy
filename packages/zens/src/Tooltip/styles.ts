import styled from 'styled-components'

import type { TooltipProps } from './index'

type TFadeIn = {
  placement?: TooltipProps['placement']
  fixed?: boolean
}

export const FadeIn = styled.div.attrs<TFadeIn>((p) => p)`
  visibility: visible;
  opacity: 1;

  &[data-enter] {
    visibility: visible;
    opacity: 1;
  }
`

export const ChildItem = styled.div`
  display: inline-block;
`
