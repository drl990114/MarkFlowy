import { createGlobalStyle } from 'styled-components'

export const DesktopSpecificStyles = createGlobalStyle`
  html {
    border-radius: 10px;
    overflow: hidden;
    background-color:  ${(props) => props.theme.bgColor};
  }

  body {
    background-color: ${(props) => props.theme.bgColor};
    color: ${(props) => props.theme.primaryFontColor};
    overflow: hidden;
    line-height: normal;
    font-family: "Open Sans", "Clear Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  }

  * {
    border-color: ${(props) => props.theme.borderColor};
  }
`

export { GlobalStyles } from '@markflowy/interface'
