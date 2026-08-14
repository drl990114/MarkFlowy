import { createGlobalStyle } from 'styled-components'

export const GlobalStyles = createGlobalStyle`
  .icon {
    flex: 0 0 auto;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 32px;
    width: 32px;
    font-size: 1rem;
    cursor: pointer;
    transition:
      color 100ms ease,
      background-color 100ms ease,
      opacity 100ms ease;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-feature-settings: "liga" 1, "calt" 1;
    font-display: swap;

    &:hover {
      color: ${(props) => props.theme.primaryFontColor};
      background-color: ${(props) => props.theme.hoverColor};
    }

    &--active {
      color: ${(props) => props.theme.accentColor};
    }

    &-unselected {
      color: ${(props) => props.theme.unselectedFontColor};
    }

    &-disabled {
      color: ${(props) => props.theme.disabledFontColor};
      cursor: not-allowed;
    }
  }

  .icon-small {
    height: 22px;
    width: 22px;
    font-size: 14px;
  }

  .icon-medium {
    height: 32px;
    width: 32px;
    font-size: 16px;
  }

  .icon-large {
    height: 40px;
    width: 40px;
    font-size: 18px;
  }

  .icon-rounded {
    border-radius: 50%;
  }

  .icon-smooth {
    border-radius: 6px;
  }

  .icon-square {
    border-radius: 0;
  }

  .popover {
    border: 1px solid ${(props) => props.theme.borderColor};
  }

  .display-none {
    display: none;
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
