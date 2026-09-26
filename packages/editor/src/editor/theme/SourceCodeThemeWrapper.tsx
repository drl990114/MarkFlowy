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

const styleOnlyProps = new Set(['codeEditor', 'dark', 'rootFontSize', 'rootLineHeight'])

export const SourceCodeThemeWrapper = styled.div
  .withConfig({
    shouldForwardProp: (prop) => !styleOnlyProps.has(prop),
  })
  .attrs<WarpperProps>((p) => ({
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
  padding-inline: 16px;
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
      padding: 0 0 0 12px;

      span {
        line-height: inherit;
      }
    }

    .cm-content {
      background-color: ${(props) => props.theme.bgColor};
      padding-block: 16px;
    }
    .cm-scroller .cm-gutters {
      background-color: ${(props) => props.theme.bgColor};
    }
    .cm-lineNumbers .cm-gutterElement {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }

    .cm-lineNumbers .cm-activeLineGutter {
      color: ${(props) => props.theme.primaryFontColor};
    }

    .cm-activeLine,
    .cm-activeLineGutter {
      background-color: ${(props) => props.theme.tipsBgColor};
    }

    .cm-scroller {
      font-family: inherit;
      line-height: inherit;
    }
    .cm-gutters {
      border: none;
    }

    .cm-gutter.cm-lineNumbers {
      color: ${(props) => props.theme.labelFontColor};
    }

    .cm-foldGutter {
      color: ${(props) => props.theme.labelFontColor};

      .cm-gutterElement {
        padding-inline: 2px;
      }

      span {
        display: inline-block;
        min-width: 14px;
        border-radius: ${(props) => props.theme.smallBorderRadius};
        text-align: center;
        cursor: default;
      }

      span:hover {
        background-color: ${(props) => props.theme.hoverColor};
        color: ${(props) => props.theme.primaryFontColor};
      }
    }

    .cm-foldPlaceholder {
      padding: 0 4px;
      border: 1px solid ${(props) => props.theme.borderColor};
      border-radius: ${(props) => props.theme.smallBorderRadius};
      background-color: ${(props) => props.theme.tipsBgColor};
      color: ${(props) => props.theme.primaryFontColor};
      cursor: default;
    }

    /* CodeMirror creates these controls; keep their UI typography independent of the document. */
    .cm-tooltip,
    .cm-panels {
      font-family: ${(props) => props.theme.fontFamily};
      font-size: ${(props) => props.theme.fontSm};
      line-height: 18px;
      color: ${(props) => props.theme.primaryFontColor};
      background-color: ${(props) => props.theme.contextMenuBgColor};
      white-space: normal;
    }

    .cm-tooltip {
      border: 1px solid ${(props) => props.theme.borderColor};
      border-radius: ${(props) => props.theme.midBorderRadius};
      box-shadow: 0 4px 12px ${(props) => props.theme.boxShadowColor};
    }

    .cm-tooltip.cm-tooltip-autocomplete > ul {
      padding: 4px;
      font-family: inherit;
      max-height: 280px;
    }

    .cm-tooltip-autocomplete > ul > li {
      box-sizing: border-box;
      min-height: 28px;
      padding: 4px 8px;
      border-radius: ${(props) => props.theme.smallBorderRadius};
      line-height: 18px;
      cursor: default;
    }

    .cm-tooltip-autocomplete > ul > li:hover,
    .cm-tooltip-autocomplete > ul > li[aria-selected] {
      color: ${(props) => props.theme.primaryFontColor};
      background-color: ${(props) => props.theme.contextMenuBgColorHover};
    }

    .cm-tooltip-autocomplete-disabled > ul > li[aria-selected] {
      color: ${(props) => props.theme.labelFontColor};
      background-color: ${(props) => props.theme.tipsBgColor};
    }

    .cm-tooltip-autocomplete > ul > completion-section {
      padding: 4px 8px;
      border-color: ${(props) => props.theme.borderColor};
      color: ${(props) => props.theme.labelFontColor};
      font-size: ${(props) => props.theme.fontXs};
      line-height: 18px;
      opacity: 1;
    }

    .cm-completionLabel {
      font-family: ${(props) => props.theme.codemirrorFontFamily};
    }

    .cm-completionDetail,
    .cm-completionIcon {
      color: ${(props) => props.theme.labelFontColor};
      font-style: normal;
      opacity: 1;
    }

    .cm-tooltip.cm-completionInfo {
      padding: 8px 10px;
    }

    .cm-panels-top {
      border-bottom: 1px solid ${(props) => props.theme.borderColor};
    }

    .cm-panels-bottom {
      border-top: 1px solid ${(props) => props.theme.borderColor};
    }

    .cm-panel.cm-search,
    .cm-panel.cm-gotoLine,
    .cm-dialog {
      position: relative;
      padding: 6px 36px 6px 8px;
    }

    .cm-panel label,
    .cm-dialog label {
      font-size: inherit;
    }

    .cm-panel .cm-textfield,
    .cm-panel .cm-button {
      box-sizing: border-box;
      min-height: 28px;
      padding: 3px 8px;
      border: 1px solid ${(props) => props.theme.borderColor};
      border-radius: ${(props) => props.theme.smallBorderRadius};
      font: inherit;
      color: ${(props) => props.theme.primaryFontColor};
      background: ${(props) => props.theme.bgColor};
    }

    .cm-panel .cm-button:hover,
    .cm-panel .cm-button:active,
    .cm-panel button[name='close']:hover,
    .cm-dialog-close:hover,
    .cm-foldPlaceholder:hover {
      background: ${(props) => props.theme.contextMenuBgColorHover};
    }

    .cm-panel button[name='close'],
    .cm-dialog-close {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 24px;
      height: 24px;
      margin: 0;
      padding: 0;
      border: none;
      border-radius: ${(props) => props.theme.smallBorderRadius};
      font: inherit;
      color: inherit;
      background: transparent;
      cursor: default;
    }

    .cm-panel input[type='checkbox'] {
      accent-color: ${(props) => props.theme.accentColor};
      vertical-align: middle;
    }

    .cm-panel :is(input, button):focus-visible,
    .cm-tooltip :is(a, button):focus-visible {
      outline: 2px solid ${(props) => props.theme.accentColor};
      outline-offset: 1px;
    }
  }

  .cm-editor .cm-searchMatch,
  .cm-editor .cm-searchMatch-selected,
  .cm-editor .cm-search-match,
  .cm-editor .cm-search-active {
    background-color: var(
      --rme-editor-selection-bg,
      ${(props) => props.theme.selectionMatchBgColor}
    );
    color: var(--rme-editor-selection-foreground, ${(props) => props.theme.primaryFontColor});
    border-radius: 2px;

    span {
      color: inherit;
    }
  }

  .cm-editor .cm-search-active,
  .cm-editor .cm-searchMatch-selected {
    outline: 1px solid ${(props) => props.theme.accentColor};
    outline-offset: -1px;
  }

  ${(props) =>
    props.dark &&
    css`
      color-scheme: dark;
    `}
`
