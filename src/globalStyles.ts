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

  /* Styles for scrollbar */

  ::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }

  ::-webkit-scrollbar-track {
    background: #222426;
  }

  ::-webkit-scrollbar-thumb {
    background: #465056;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
`
