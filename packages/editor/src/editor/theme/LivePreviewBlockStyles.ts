import { css } from 'styled-components'
import { editorZIndex } from './z-index'

export const livePreviewBlockStyles = css`
  .mf-live-preview-block {
    position: relative;
    display: flex;
    flex-direction: column;
    margin: 0.5em 0 0.75em;
    overflow: hidden;
    border: 1px solid ${(props) => props.theme.borderColor};
    border-radius: 6px;
    background: ${(props) => props.theme.bgColor};
    box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
  }

  .mf-live-preview-selected {
    border-color: ${(props) => props.theme.accentColor};
    box-shadow: 0 0 0 1px ${(props) => props.theme.accentColor};
  }

  .mf-live-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 30px;
    padding: 0 6px 0 10px;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    background: ${(props) => props.theme.preBgColor};
  }

  .mf-live-preview-language {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    height: 100%;
    color: ${(props) => props.theme.labelFontColor};
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .mf-live-preview-toolbar {
    display: inline-flex;
    align-items: center;
    gap: 1px;
  }

  .mf-live-preview-tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: ${(props) => props.theme.smallBorderRadius};
    color: ${(props) => props.theme.labelFontColor};
    background: transparent;
    cursor: pointer;
    line-height: 1;

    i {
      font-size: 15px;
    }

    &:hover {
      color: ${(props) => props.theme.primaryFontColor};
      border-color: ${(props) => props.theme.borderColor};
      background: ${(props) => props.theme.hoverColor};
    }

    &:focus-visible {
      outline: 2px solid ${(props) => props.theme.accentColor};
      outline-offset: -2px;
    }

    &:disabled {
      opacity: 0.55;
      cursor: default;
    }

    &:disabled:hover {
      color: ${(props) => props.theme.labelFontColor};
      border-color: transparent;
      background: transparent;
    }
  }

  .mf-live-preview-body {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
    flex: 1;
    min-height: 0;
  }

  .mf-live-preview-editor {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: ${(props) => props.theme.preBgColor};

    .cm-editor {
      height: 100%;
      min-height: 0;
      margin: 0;
      padding: 6px 0;
      border-radius: 0;
      background: ${(props) => props.theme.preBgColor};
    }

    .cm-scroller {
      overflow: auto;
    }
  }

  .mf-live-preview-divider {
    position: relative;
    z-index: ${editorZIndex.inlineWidget};
    width: 1px;
    height: 100%;
    padding: 0;
    border: 0;
    border-left: 1px solid ${(props) => props.theme.borderColor};
    background: ${(props) => props.theme.borderColor};
  }

  .mf-live-preview-render {
    box-sizing: border-box;
    min-width: 0;
    min-height: 0;
    padding: 14px 16px;
    overflow: auto;
    color: inherit;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    background: ${(props) => props.theme.bgColor};
    cursor: default;
  }

  .mf-live-preview-render > * {
    max-width: 100%;
  }

  .mf-live-preview-render svg {
    max-width: 100%;
  }

  .mf-live-preview-html .mf-live-preview-render li > p {
    margin: 0;
  }

  .mf-live-preview-html .mf-live-preview-render li > p + p {
    margin-top: 0.5em;
  }

  .mf-live-preview-html .mf-live-preview-render {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .mf-live-preview-math .mf-live-preview-render,
  .mf-live-preview-mermaid .mf-live-preview-render {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mf-live-preview-error {
    margin: 0;
    white-space: pre-wrap;
    color: ${(props) => props.theme.dangerColor};
    font-family: ${(props) => props.theme.codemirrorFontFamily};
    font-size: 12px;
    line-height: 1.5;
  }

  .mf-live-preview-error-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .mf-live-preview-error-action {
    min-height: 24px;
    padding: 2px 8px;
    border: 1px solid ${(props) => props.theme.borderColor};
    border-radius: ${(props) => props.theme.smallBorderRadius};
    color: ${(props) => props.theme.primaryFontColor};
    background: ${(props) => props.theme.bgColor};
    cursor: pointer;
    font: inherit;
    font-size: 12px;

    &:hover {
      background: ${(props) => props.theme.hoverColor};
    }

    &:focus-visible {
      outline: 2px solid ${(props) => props.theme.accentColor};
      outline-offset: 1px;
    }
  }

  .mf-live-preview-render-error {
    background: ${(props) => props.theme.tipsBgColor};
  }

  .mf-live-preview-block[data-mode='split'] {
    min-height: 200px;

    .mf-live-preview-body,
    .mf-live-preview-editor,
    .mf-live-preview-render,
    .mf-live-preview-editor .cm-editor {
      min-height: 168px;
    }
  }

  .mf-live-preview-block[data-mode='preview'] {
    .mf-live-preview-body {
      display: block;
      min-height: 0;
    }

    .mf-live-preview-editor {
      display: none;
    }

    .mf-live-preview-divider {
      display: none;
    }

    .mf-live-preview-render {
      width: 100%;
      min-height: 0;
      padding: 14px 16px;
    }
  }

  .mf-live-preview-fullscreen {
    position: fixed;
    inset: 0;
    z-index: ${editorZIndex.fullscreen};
    min-height: 0;
    margin: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;

    .mf-live-preview-body,
    .mf-live-preview-editor,
    .mf-live-preview-render,
    .mf-live-preview-editor .cm-editor {
      min-height: 0;
    }
  }

  .mf-live-preview-fullscreen[data-mode='split'] {
    min-height: 0;

    .mf-live-preview-body,
    .mf-live-preview-editor,
    .mf-live-preview-render,
    .mf-live-preview-editor .cm-editor {
      min-height: 0;
    }
  }

  .mf-live-preview-fullscreen[data-mode='preview'] {
    .mf-live-preview-body {
      height: 100%;
    }

    .mf-live-preview-render {
      height: 100%;
    }
  }
`
