import styled, { css } from 'styled-components'
import { FlatListStyles } from './FlatListStyles'
import { livePreviewBlockStyles } from './LivePreviewBlockStyles'
import { editorZIndex } from './z-index'

interface WrapperProps {
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

export const WysiwygThemeWrapper = styled.div.attrs<WrapperProps>((p) => ({
  rootFontSize: '15px',
  rootLineHeight: '1.6',
  ...p,
}))`
  width: 100%;
  position: relative;
  /* white-space: pre-wrap; */
  -ms-text-size-adjust: 100%;
  -webkit-text-size-adjust: 100%;
  margin: 0;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.rootFontSize};
  line-height: ${(props) => props.rootLineHeight};
  background-color: ${(props) => props.theme.bgColor};
  color: ${(props) => props.theme.primaryFontColor};
  word-wrap: break-word;
  white-space: pre-wrap;
  padding-bottom: 1em;
  box-sizing: border-box;
  outline: none;

  & summary {
    display: list-item;
  }

  & a {
    background-color: transparent;
    color: ${(props) => props.theme.accentColor};
    text-decoration: none;
  }

  & b,
  & strong {
    color: ${(props) => props.theme.strongFontColor};
    font-weight: 700;
  }

  & dfn {
    font-style: italic;
  }

  & mark {
    background-color: ${(props) => props.theme.markBgColor};
    color: ${(props) => props.theme.markFontColor};
  }

  & small {
    font-size: 0.9em;
  }

  & sub,
  & sup {
    font-size: 0.75em;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }

  & sub {
    bottom: -0.25em;
  }

  & sup {
    top: -0.5em;
  }

  & img {
    border-style: none;
    max-width: 100%;
    box-sizing: content-box;
    background-color: ${(props) => props.theme.imgBgColor};
    vertical-align: bottom;
  }

  & hr {
    box-sizing: content-box;
    height: 4px;
    margin: 1.5em 0;
    border: 0;
    background: ${(props) => props.theme.hrBgColor};
  }

  & kbd {
    display: inline-block;
    padding: 3px 5px;
    font:
      11px ui-monospace,
      SFMono-Regular,
      SF Mono,
      Menlo,
      Consolas,
      Liberation Mono,
      monospace;
    color: ${(props) => props.theme.kbdFontColor};
    vertical-align: middle;
    background-color: ${(props) => props.theme.kbdBgColor};
    border: solid 1px ${(props) => props.theme.kbdBorderColor};
    border-radius: 6px;
  }

  & table th,
  & table td {
    position: relative;
    border: 1px solid ${(props) => props.theme.tableTdBorderColor};
  }

  & table tr {
    background-color: ${(props) => props.theme.tableTrBgColor};
    border-top: 1px solid ${(props) => props.theme.tableTrBorderColor};
  }

  & table tr:nth-child(2n) {
    background-color: ${(props) => props.theme.tableTrDeepBgColor};
  }

  & code,
  & tt {
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 0.85em;
    white-space: break-spaces;
    background-color: ${(props) => props.theme.codeBgColor};
    border-radius: 6px;
  }

  & tt,
  & code,
  & kbd,
  & pre,
  & samp {
    font-size: 0.85em;
    font-family: ${(props) => props.theme.codemirrorFontFamily};
  }

  & figure {
    margin: 1em 40px;
  }

  & input {
    font: inherit;
    margin: 0;
    overflow: visible;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
  }

  & a:hover {
    text-decoration: underline;
  }

  & hr::before {
    display: table;
    content: '';
  }

  & hr::after {
    display: table;
    clear: both;
    content: '';
  }

  & table {
    position: relative;
    border-spacing: 0;
    border-collapse: collapse;
    display: block;
    width: max-content;
    max-width: 100%;
    overflow: auto;
    margin: 2em 0;
  }

  & td,
  & th {
    padding: 0;
  }

  & input[type='checkbox'] {
    /* Add if not using autoprefixer */
    -webkit-appearance: none;
    /* Remove most all native input styles */
    appearance: none;
    /* Not removed via appearance */
    margin: 0;

    font: inherit;
    color: currentColor;
    width: 1.15em;
    height: 1.15em;
    border: 1px solid currentColor;
    border-radius: 4px;
    transform: translateY(0.25em);

    display: grid;
    place-content: center;
  }

  & input[type='checkbox']:checked {
    background-color: ${(props) => props.theme.accentColor};
  }

  & input[type='checkbox']:checked::before {
    transform: scale(1);
  }

  & input[type='checkbox']::before {
    content: '';
    width: 0.75em;
    height: 0.75em;
    clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
    transform: scale(0);
    transform-origin: bottom left;
    transition: 120ms transform ease-in-out;
    background-color: ${(props) => props.theme.bgColor};
  }

  & input[type='checkbox']:focus {
    outline: max(2px, 0.15em) solid currentColor;
    outline-offset: max(2px, 0.15em);
  }

  & input[type='checkbox']:disabled {
    color: ${(props) => props.theme.labelFontColor};
    cursor: not-allowed;
  }

  & a:focus,
  & [role='button']:focus,
  & input[type='radio']:focus,
  & input[type='checkbox']:focus {
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: -2px;
    box-shadow: none;
  }

  & a:focus:not(:focus-visible),
  & [role='button']:focus:not(:focus-visible),
  & input[type='radio']:focus:not(:focus-visible),
  & input[type='checkbox']:focus:not(:focus-visible) {
    outline: solid 1px transparent;
  }

  & a:focus-visible,
  & [role='button']:focus-visible,
  & input[type='radio']:focus-visible,
  & input[type='checkbox']:focus-visible {
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: -2px;
    box-shadow: none;
  }

  & a:not([class]):focus,
  & a:not([class]):focus-visible,
  & input[type='radio']:focus,
  & input[type='radio']:focus-visible,
  & input[type='checkbox']:focus,
  & input[type='checkbox']:focus-visible {
    outline-offset: 0;
  }

  & h1,
  & h2,
  & h3,
  & h4,
  & h5,
  & h6 {
    position: relative;
    margin: 0;
    line-height: 1.25;
  }

  & h1 {
    font-weight: 600;
    margin: 0.6em 0 1.2em 0;
    font-size: 1.875em;
  }

  & h2 {
    font-weight: 600;
    margin: 0.55em 0 1.1em 0;
    font-size: 1.75em;
  }

  & h3 {
    font-weight: 600;
    margin: 0.5em 0 1em 0;
    font-size: 1.6em;
  }

  & h4 {
    font-weight: 600;
    margin: 0.45em 0 0.9em 0;
    font-size: 1.46em;
  }

  & h5 {
    font-weight: 600;
    margin: 0.4em 0 0.8em 0;
    font-size: 1.3em;
  }

  & h6 {
    font-weight: 600;
    margin: 0.4em 0 0.8em 0;
    font-size: 1.2em;
  }

  & p {
    margin-top: 0;
    margin-bottom: 0.5em;
  }

  & blockquote {
    margin: 0;
    padding: 0 1em;
    color: ${(props) => props.theme.blockquoteFontColor};
    border-left: 0.25em solid ${(props) => props.theme.blockquoteBorderColor};
  }

  & ul,
  & ol {
    margin-top: 0;
    margin-bottom: 0;
    padding-left: 1.5em;
  }

  & ol ol,
  & ul ol {
    list-style-type: lower-roman;
  }

  & ul ul ol,
  & ul ol ol,
  & ol ul ol,
  & ol ol ol {
    list-style-type: lower-alpha;
  }

  & dd {
    margin-left: 0;
  }

  & pre {
    margin-top: 0;
    margin-bottom: 0;
    font-family: ${(props) => props.theme.codemirrorFontFamily};
    font-size: 0.8em;
    word-wrap: normal;
  }

  .markdown-body::before {
    display: table;
    content: '';
  }

  .markdown-body::after {
    display: table;
    clear: both;
    content: '';
  }

  & > *:first-child {
    margin-top: 0 !important;
  }

  & > *:last-child {
    margin-bottom: 0 !important;
  }

  & a:not([href]) {
    color: inherit;
    text-decoration: none;
  }

  & p,
  & blockquote,
  & ul,
  & ol,
  & dl,
  & pre,
  & details {
    margin-top: 0;
    margin-bottom: 16px;
  }

  & blockquote > :first-child {
    margin-top: 0;
  }

  & blockquote > :last-child {
    margin-bottom: 0;
  }

  & h1 tt,
  & h1 code,
  & h2 tt,
  & h2 code,
  & h3 tt,
  & h3 code,
  & h4 tt,
  & h4 code,
  & h5 tt,
  & h5 code,
  & h6 tt,
  & h6 code {
    padding: 0 0.2em;
    font-size: inherit;
  }

  & ul ul,
  & ul ol,
  & ol ol,
  & ol ul {
    margin-top: 0;
    margin-bottom: 0;
  }

  & li > p {
    margin-top: 16px;
  }

  & li + li {
    margin-top: 0.25em;
  }

  & dl {
    padding: 0;
  }

  & dl dt {
    padding: 0;
    margin-top: 16px;
    font-size: 1em;
    font-style: italic;
    font-weight: 600;
  }

  & dl dd {
    padding: 0 16px;
    margin-bottom: 16px;
  }

  & table th {
    font-weight: 600;
  }

  & table th,
  & table td {
    min-width: 60px;
    padding: 6px 20px;
  }

  & table img {
    background-color: transparent;
  }

  & img[align='right'] {
    padding-left: 20px;
  }

  & img[align='left'] {
    padding-right: 20px;
  }

  & code br,
  & tt br {
    display: none;
  }

  & del code {
    text-decoration: inherit;
  }

  & samp {
    font-size: 0.85em;
  }

  & pre code {
    font-size: 1em;
  }

  & pre > code {
    padding: 0;
    margin: 0;
    word-break: normal;
    white-space: pre;
    background: transparent;
    border: 0;
  }

  & pre {
    padding: 16px;
    overflow: auto;
    font-size: 0.85em;
    line-height: 1.45;
    background-color: ${(props) => props.theme.preBgColor};
    border-radius: 6px;
  }

  & pre code,
  & pre tt {
    display: inline;
    max-width: auto;
    padding: 0;
    margin: 0;
    overflow: visible;
    line-height: inherit;
    word-wrap: normal;
    background-color: transparent;
    border: 0;
  }

  & ul[data-task-list] {
    padding: 0;
    list-style-type: none;
  }

  .remirror-list-item-with-custom-mark {
    display: flex;
  }

  .remirror-list-item-marker-container {
    margin-right: 0.5em;
  }

  & h1 .show {
    font-size: 2rem;
  }

  & h2 .show {
    font-size: 1.5rem;
  }
  & h3 .show {
    font-size: 1.25rem;
  }

  & h4 .show {
    font-size: 1rem;
  }

  & h5 .show {
    font-size: 0.875rem;
  }

  & h6 .show {
    font-size: 0.85rem;
  }

  & .md-img-uri,
  & .md-img-text,
  & .md-link {
    font-size: 0;
    letter-spacing: 0;
  }

  & .md-html-inline {
    letter-spacing: 0;
    font-size: 0;
    background-color: ${(props) => props.theme.tipsBgColor};
    color: ${(props) => props.theme.labelFontColor};
  }

  .md-mark {
    color: ${(props) => props.theme.accentColor};
    font-size: 0;
  }

  & .inline-loading {
    width: min-content;
    height: min-content;
    display: inline-block;
    font-size: 16px;
    line-height: ${(props) => props.rootLineHeight};
    animation: loading-icon-spin 1s linear infinite;
  }

  .rme-copilot-suggestion {
    color: ${(props) => props.theme.labelFontColor};
    opacity: 0.6;
    white-space: pre-wrap;
    pointer-events: none;
  }

  @keyframes loading-icon-spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .html_tag {
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 0.85em;
    white-space: break-spaces;
    background-color: ${(props) => props.theme.codeBgColor};
    border-radius: 6px;
  }

  .show {
    font-size: ${(props) => props.rootFontSize};
  }

  .cm-editor.cm-focused {
    outline: none; // override the default outline
  }

  & .code-block__menu {
    position: relative;
    height: 26px;
    margin-bottom: -1px;
    z-index: ${editorZIndex.inlineWidget};
  }
  & .code-block__reference {
    position: absolute;
    top: 0;
    left: 0;
    width: auto;
    font-size: 0.8em;
    background-color: transparent;
    box-sizing: border-box;
    display: flex;
    align-items: center;

    &--active {
      border-bottom: none;
    }
  }

  & .code-block__languages {
    position: absolute;
    font-size: 1em;
    max-height: 180px;
    list-style: none;
    padding: 4px 0;
    margin: 6px 0 0;
    width: 200px;
    background-color: ${(props) => props.theme.bgColor};
    border: 1px solid ${(props) => props.theme.borderColor};
    overflow: auto;
    box-sizing: border-box;
    z-index: ${editorZIndex.dropdown};
    border-radius: 8px;
    box-shadow:
      0 1px 4px -2px ${(props) => props.theme.boxShadowColor},
      0 2px 8px 0 ${(props) => props.theme.boxShadowColor},
      0 8px 16px 4px ${(props) => props.theme.boxShadowColor};

    &__input {
      height: 26px;
      min-width: 72px;
      max-width: 200px;
      padding: 0 8px;
      outline: none;
      font-weight: 600;
      color: ${(props) => props.theme.primaryFontColor};
      box-sizing: border-box;
      background-color: ${(props) => props.theme.preBgColor};
      border: 1px solid ${(props) => props.theme.borderColor};
      border-radius: 4px 4px 0 0;
      font-family: ${(props) => props.theme.codemirrorFontFamily};

      &::placeholder {
        color: ${(props) => props.theme.labelFontColor};
      }

      &:focus {
        border-color: ${(props) => props.theme.accentColor};
      }
    }
  }

  & .code-block__menu + .cm-editor {
    padding-top: 8px;
    border-top-left-radius: 0;
  }

  & .code-block__language {
    padding: 0.4em 0.75em;
    font-size: 1em;
    cursor: pointer;
    transition: all 0.3s;
    border-radius: 6px;
    margin: 0 4px;
    display: flex;
    align-items: center;

    &--active {
      background-color: ${(props) => props.theme.borderColor};
    }

    &:hover {
      background-color: ${(props) => props.theme.tipsBgColor};
    }

    &--highlight {
      background-color: ${(props) => props.theme.tipsBgColor};
    }

    &--empty {
      color: ${(props) => props.theme.labelFontColor};
      cursor: default;
    }
  }

  .remirror-is-empty {
    color: ${(props) => props.theme.labelFontColor};
  }

  .node-hide {
    display: none !important;
  }

  .node-show {
    display: block;
    margin-bottom: 0;
    transition: all 0.3s;
  }

  .inline-node-show {
    display: inline-block;
  }

  .inline-input {
    position: relative;
  }

  .inline-input-src {
    display: inline;
    padding: 0.2em 0.4em;
    margin: 0;
    background-color: ${(props) => props.theme.codeBgColor};
    border-radius: 6px;
    br {
      display: none;
    }
  }

  .inline-input-preview {
    position: absolute;
    top: calc(100% + 0.5em);
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    padding: 0.5em 1em;
    max-width: 400px;
    border-radius: 0.2em;
    background-color: ${(props) => props.theme.bgColor};
    line-height: normal;
    z-index: ${editorZIndex.inlineWidget};
  }

  .inline-input-render {
    line-height: normal;

    svg {
      vertical-align: middle;
      max-width: 100%;
    }
  }

  .reference-def {
    .reference-definition-node {
      &__label {
        display: inline-block;
        outline: none;
        &::before {
          content: '[ ';
          margin: 0 0.2em;
          color: ${(props) => props.theme.labelFontColor};
        }
        &::after {
          content: ' ] : ';
          margin: 0 0.2em;
          color: ${(props) => props.theme.labelFontColor};
        }
      }

      &__href {
        display: inline-block;
        margin-right: 4px;
        outline: none;

        &:empty:before {
          content: 'href empty';
          font-style: italic;
        }
      }

      &__title {
        display: inline-block;
        outline: none;
        &:not(:empty):before {
          content: '"';
          margin: 0 0.2em;
          color: ${(p) => p.theme.labelFontColor};
        }
        &:not(:empty):after {
          content: '"';
          margin: 0 0.2em;
          color: ${(p) => p.theme.labelFontColor};
        }
      }
    }

    &.rme-block-focus {
      .reference-definition-node__title:empty::before {
        content: '"  title (optional)  "';
        color: ${(p) => p.theme.labelFontColor};
      }
      .reference-definition-node__title:empty::after {
        content: '';
        display: none;
      }
    }
  }

  ${livePreviewBlockStyles}

  & .ProseMirror-focused {
    outline: none;
  }

  .img-input__container {
    display: flex;
  }

  .cm-render-node {
    position: relative;

    &:hover {
      .cm-render-node-label {
        opacity: 1;
      }
    }
  }

  .cm-render-node-label {
    position: absolute;
    top: 6px;
    right: 6px;
    padding: 4px 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0;
    transition: all 0.3s;
    font-size: 12px;
    cursor: pointer;
    color: ${(props) => props.theme.labelFontColor};

    &-icon {
      font-size: 16px;
    }

    &:hover {
      background-color: ${(props) => props.theme.hoverColor};
    }
  }

  .node-enter {
    & .cm-render-node-label {
      opacity: 1;
    }
  }

  .cm-selectionMatch {
    background-color: ${(props) => props.theme.selectionMatchBgColor};
  }

  .cm-copy-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    padding: 4px 8px;
    transition: all 0.3s;
    font-size: small;
    border-radius: ${(props) => props.theme.smallBorderRadius};
    cursor: pointer;
    z-index: ${editorZIndex.copyButton};
    color: ${(props) => props.theme.labelFontColor};
    background: ${(props) => props.theme.hoverColor};
  }

  .cm-editor {
    height: auto;
    padding: 12px 0;
    margin-bottom: 1em;
    line-height: ${(props) => props.rootLineHeight};
    font-size: ${(props) => props.rootFontSize};
    font-family: ${(props) => props.theme.codemirrorFontFamily} !important;
    border-radius: ${(props) => props.theme.smallBorderRadius};
    background-color: ${(props) => props.theme.preBgColor};
    overflow: auto;

    &[data-front-matter='true'] {
      .cm-lineNumbers {
        display: none !important;
      }
    }
    .cm-line {
      padding: 2px 2px 2px 6px;
      font-size: 0.85em;
      font-family: ${(props) => props.theme.codemirrorFontFamily};

      span {
        line-height: ${(props) => props.rootLineHeight};
      }
    }

    .cm-content {
      background-color: ${(props) => props.theme.preBgColor};
    }
    .cm-scroller .cm-gutters {
      font-family: inherit;
      background-color: ${(props) => props.theme.preBgColor};
    }
    .cm-lineNumbers .cm-gutterElement {
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: ${(props) => props.theme.preBgColor};
    }

    .cm-gutters {
      border: none;
    }

    .cm-gutter.cm-lineNumbers {
      color: ${(props) => props.theme.labelFontColor};
    }
  }

  p[data-placeholder] {
    &::before {
      position: absolute;
      pointer-events: none;
      color: ${(props) => props.theme.placeholderFontColor};
      height: 0;
      font-style: italic;
      content: attr(data-placeholder);
    }
  }

  .remirror-editor {
    /* height: 100%; */
    outline: none;
  }

  .remirror-floating-popover {
    /* padding: var(--rmr-space-2); */
    padding: 0;
    border: none;
    max-height: calc(100vh - 56px);
  }

  .remirror-positioner {
    position: absolute;
    min-width: 1px;
    min-height: 1px;
    pointer-events: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    cursor: none;
    z-index: ${editorZIndex.hidden};
  }

  .remirror-positioner-widget {
    width: 0;
    height: 0;
    position: absolute;
  }

  .remirror-emoji-wrapper img {
    width: 1em;
    vertical-align: middle;
    background-color: transparent;
  }

  .rme-find-decoration,
  .ProseMirror-search-match,
  .cm-search-match {
    background-color: ${(props) => props.theme.selectionMatchBgColor};
    color: ${(props) => props.theme.primaryFontColor};
  }

  .rme-find-active-decoration,
  .ProseMirror-active-search-match,
  .cm-search-active {
    background-color: ${(props) => props.theme.accentColor};
    color: ${(props) => props.theme.bgColor};
  }

  & .html-image-node-view-wrapper,
  & .md-image-node-view-wrapper {
    display: inline-flex;
    padding: 0 2px;
    vertical-align: bottom;
    z-index: ${editorZIndex.inlineWidget};
  }

  & .ai-block-node-view-wrapper {
    border-radius: ${(props) => props.theme.smallBorderRadius};
  }

  & .ProseMirror-selectednode {
    outline: 1px solid ${(props) => props.theme.nodeSelectedColor};
    border-radius: 6px;
    background-color: ${(props) => props.theme.nodeSelectedColor};
  }

  .rme-dragging {
    & .ProseMirror-selectednode {
      outline-color: transparent !important;
      background-color: transparent !important;
    }
  }

  .rme-drop-cursor {
    background-color: ${(props) => props.theme.accentColor} !important;
  }

  & .ProseMirror th.selectedCell,
  & .ProseMirror td.selectedCell {
    border-style: double;
    border-color: ${(props) => props.theme.tableSelectorCellBorderColor};
    background-color: ${(props) => props.theme.tableSelectorCellBgColor};
  }

  & .ProseMirror .tableWrapper {
    overflow: visible;
  }

  & .ProseMirror table {
    overflow: visible;

    .rme-table-selector {
      cursor: pointer;
      background-color: ${(props) => props.theme.tableSelectorBgColor};
      transition: background-color 0.2s ease-in-out;
      border-radius: 4px;

      &:hover {
        background-color: ${(props) => props.theme.tableSelectorBgColor};
      }
    }

    .rme-table-selector-highlight {
      outline-color: ${(props) => props.theme.tableSelectorHightBorderColor};
      background-color: ${(props) => props.theme.tableSelectorHightColor};

      &:hover {
        background-color: ${(props) => props.theme.tableSelectorHightHoverColor};
      }
    }

    .rme-table-body-selector {
      position: absolute;
      width: 18px;
      height: 18px;
      top: -22px;
      left: -22px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .rme-table-row-selector {
      position: absolute;
      width: 12px;
      top: 0;
      bottom: 0;
      left: -16px;
      border-radius: 2px;
    }

    .rme-table-column-selector {
      position: absolute;
      height: 12px;
      left: 0;
      right: 0;
      top: -16px;
      border-radius: 2px;
    }
  }

  /* Import flat list styles */
  ${FlatListStyles}

  ${(props) =>
    props.dark &&
    css`
      color-scheme: dark;
    `}
`
