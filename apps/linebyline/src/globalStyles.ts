import { createGlobalStyle } from 'styled-components'
import type { MThemeProps } from './hooks/useTheme'

export const GlobalStyles = createGlobalStyle<MThemeProps>`
  body {
    background-color: ${(props) => props.theme.bgColor};
    color: ${(props) => props.theme.primaryFontColor};
    font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";
  }

  .icon {
    padding: 8px;
    font-size: 1rem;
    cursor: pointer;

    &-border {
      border: 2px solid transparent;
      box-sizing: border-box;

      &:hover {
        border: 2px solid ${(props) => props.theme.borderColor};
      }
    }
    &:hover {
      color: ${(props) => props.theme.accentColor};
      background-color: ${(props) => props.theme.tipsBgColor};
    }
  }

  .label-default {
    color: ${(props) => props.theme.primaryFontColor};
    background-color: ${(props) => props.theme.bgColor};

    &:hover {
      color: ${(props) => props.theme.accentColor};
      background-color: ${(props) => props.theme.tipsBgColor};
    }
  }

  .w-full {
    width: 100%;
  }

  .h-full {
    height: 100%;
  }

  .split {
    height: 1px;
    width: 100%;
    background-color: ${(props) => props.theme.borderColor};
  }

  .fjic {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .cursor-pointer {
    cursor: pointer;
  }

  .overflow-scroll {
    overflow: scroll;
  }

  .overflow-auto {
    overflow: auto;
  }

  /* Styles for scrollbar */

  ::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }

  ::-webkit-scrollbar-track {
    background: ${(props) => props.theme.borderColor};
  }

  ::-webkit-scrollbar-thumb {
    background: ${(props) => props.theme.labelFontColor};
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${(props) => props.theme.labelFontColor};
  }
`
