import styled, { css } from 'styled-components'

interface WarpperProps {
  codeEditor?: boolean
  dark?: boolean
  /**
   * @default 15px
   */
  rootFontSize?: string
  /**
   * @default 1.6
   */
  rootLineHeight?: string
}

export const SourceCodeThemeWrapper = styled.div.attrs<WarpperProps>((p) => ({
  rootFontSize: '15px',
  rootLineHeight: '1.6',
  ...p,
}))`
  width: 100%;
  position: relative;
  white-space: pre-wrap;
  -ms-text-size-adjust: 100%;
  -webkit-text-size-adjust: 100%;
  margin: 0;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.rootFontSize};
  line-height: ${(props) => props.rootLineHeight};
  background-color: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  word-wrap: break-word;
  padding-bottom: 1em;
  box-sizing: border-box;
  outline: none;

  .cm-selectionMatch {
    background-color: ${(props) => props.theme.selectionMatchBgColor};
  }

  .cm-editor {
    margin-bottom: 1em;
    line-height: ${(props) => props.rootLineHeight};
    font-size: ${(props) => props.rootFontSize};
    font-family: ${(props) => props.theme.codemirrorFontFamily} !important;
    background-color: ${(props) => props.theme.bgColor};

    &.cm-focused {
      outline: none;
    }

    .cm-line {
      padding: 2px 2px 2px 6px;

      span {
        line-height: ${(props) => props.rootLineHeight};
      }
    }

    .cm-content {
      background-color: ${(props) => props.theme.bgColor};
    }
    .cm-scroller .cm-gutters {
      background-color: ${(props) => props.theme.bgColor};
    }
    .cm-lineNumbers .cm-gutterElement {
      margin: 0;
      background-color: ${(props) => props.theme.bgColor};
    }

    .cm-scroller {
      font-family: inherit;
    }
    .cm-gutters {
      border: none;
    }

    .cm-gutter.cm-lineNumbers {
      color: ${(props) => props.theme.labelFontColor};
    }
  }

  .cm-search-match {
    background-color: yellow;
    color: #222;
  }

  .cm-search-active {
    background-color: orange;
    color: #222;
  }

  ${(props) =>
    props.dark &&
    css`
      color-scheme: dark;
    `}
`
