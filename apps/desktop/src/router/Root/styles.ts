import { Separator } from 'react-resizable-panels'
import styled from 'styled-components'

export const StyleSeparator = styled(Separator)`
  background-color: ${(props) => props.theme.borderColor};
  cursor: col-resize !important;
  width: 1px;
  transition: all 0.2s ease;
  position: relative;

  &:focus {
    outline: 1px solid ${(props) => props.theme.accentColor};
  }

  &[data-separator='hover'] {
    background-color: ${(props) => props.theme.accentColor};
  }

  &[data-separator='active'] {
    background-color: ${(props) => props.theme.accentColor};
  }
`
