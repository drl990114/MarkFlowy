import { createGlobalStyle } from 'styled-components'

export const GlobalStyles = createGlobalStyle`
  body {
    background-color: ${(props) => props.theme.bgColor};
    color: ${(props) => props.theme.primaryFontColor};
    font-family: "Open Sans", "Clear Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
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

    &--active {
      color: ${(props) => props.theme.accentColor};
      font-weight: 1000;
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

  .display-none {
    display: none;
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
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: ${(props) => props.theme.scrollbarTrackColor};
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 6px;
    background: ${(props) => props.theme.scrollbarThumbColor};
  }
`
