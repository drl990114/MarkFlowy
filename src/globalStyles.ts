import styled from 'styled-components'
import customColors from './colors'

export const GlobalStyles = styled.div`

  .icon {
    padding: 8px;
    font-size: 1rem;
    cursor: pointer;

    &:hover {
      color: ${customColors.accentColor};
      background-color: ${customColors.tipsBgColor};
    }
  }
`
