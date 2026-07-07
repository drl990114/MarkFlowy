import { css } from 'styled-components'
import { editorZIndex } from './z-index'

export const livePreviewBlockStyles = css`
  .mf-live-preview-block {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 200px;
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
  }

  .mf-live-preview-body {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
    flex: 1;
    min-height: 168px;
  }

  .mf-live-preview-editor {
    min-width: 0;
    min-height: 168px;
    overflow: hidden;
    background: ${(props) => props.theme.preBgColor};

    .cm-editor {
      height: 100%;
      min-height: 168px;
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
    color: ${(props) => props.theme.labelFontColor};
    cursor: pointer;

    i {
      position: absolute;
      top: 50%;
      left: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 34px;
      transform: translate(-50%, -50%);
      border: 1px solid ${(props) => props.theme.borderColor};
      border-radius: 6px;
      background: ${(props) => props.theme.bgColor};
      font-size: 13px;
    }

    &:hover i {
      color: ${(props) => props.theme.primaryFontColor};
      background: ${(props) => props.theme.hoverColor};
    }
  }

  .mf-live-preview-render {
    box-sizing: border-box;
    min-width: 0;
    min-height: 168px;
    padding: 14px 16px;
    overflow: auto;
    background: ${(props) => props.theme.bgColor};
    cursor: zoom-in;
  }

  .mf-live-preview-render > * {
    max-width: 100%;
  }

  .mf-live-preview-render svg {
    max-width: 100%;
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

  .mf-live-preview-render-error {
    background: ${(props) => props.theme.tipsBgColor};
  }

  .mf-live-preview-block[data-mode='preview'] {
    .mf-live-preview-body {
      display: block;
      min-height: 168px;
    }

    .mf-live-preview-editor {
      display: none;
    }

    .mf-live-preview-divider {
      position: absolute;
      top: 50%;
      left: 0;
      width: 0;
      height: 0;
      border: 0;
      background: transparent;
      transform: translateY(-50%);
    }

    .mf-live-preview-divider i {
      left: 0;
      transform: translate(-50%, -50%) rotate(180deg);
      background: ${(props) => props.theme.preBgColor};
    }

    .mf-live-preview-render {
      width: 100%;
      min-height: 168px;
      padding: 14px 16px;
    }
  }

  /*
   * mermaid 的 split 模式改为上下分栏:源码在上、渲染图在下。
   * 流程图通常较宽,左右分栏会让两侧都很挤;上下分栏让两边都占满宽度,
   * 图最大最清晰,且源码仍可编辑。仅影响 mermaid,math/html 不变。
   */
  .mf-live-preview-mermaid[data-mode='split'] {
    .mf-live-preview-body {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(120px, auto) auto auto;
    }

    /* 中间分隔线由竖变横 */
    .mf-live-preview-divider {
      width: 100%;
      height: 1px;
      border-left: 0;
      border-top: 1px solid ${(props) => props.theme.borderColor};

      i {
        width: 34px;
        height: 16px;
        transform: translate(-50%, -50%) rotate(90deg);
      }
    }

    /* 渲染区紧贴图内容,去掉居中造成的四周大片留白 */
    .mf-live-preview-render {
      align-items: flex-start;
      justify-content: flex-start;
      min-height: 0;
      padding: 8px 10px;
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

    .mf-live-preview-render {
      cursor: default;
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
