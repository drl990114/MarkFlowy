import { createGlobalStyle } from 'styled-components'

/**
 * To format for createGlobalStyle
 * @see https://github.com/prettier/prettier/issues/11196
 */
const styled = { createGlobalStyle }

export const BaseStyle = styled.createGlobalStyle`
  html,
  body {
    font-family: ${(props) => props.theme.fontFamily};
    font-size: 16px;
    line-height: ${(props) => props.theme.lineHeightBase};
  }

  .markdown-body {
    -ms-text-size-adjust: 100%;
    -webkit-text-size-adjust: 100%;
    margin: 0;
    font-family: ${(props) => props.theme.fontFamily};
    font-size: ${(props) => props.theme.fontBase};
    line-height: ${(props) => props.theme.lineHeightBase};
    word-wrap: break-word;
    padding-bottom: 1em;
    box-sizing: border-box;
  }

  .markdown-body summary {
    display: list-item;
  }

  .markdown-body a {
    background-color: transparent;
    color: #58a6ff;
    text-decoration: none;
  }

  .markdown-body b,
  .markdown-body strong {
    font-weight: 600;
  }

  .markdown-body dfn {
    font-style: italic;
  }

  .markdown-body mark {
    background-color: rgba(187, 128, 9, 0.15);
    color: #c9d1d9;
  }

  .markdown-body small {
    font-size: 90%;
  }

  .markdown-body sub,
  .markdown-body sup {
    font-size: 75%;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }

  .markdown-body sub {
    bottom: -0.25em;
  }

  .markdown-body sup {
    top: -0.5em;
  }

  .markdown-body img {
    border-style: none;
    max-width: 100%;
    box-sizing: content-box;
  }

  .markdown-body code,
  .markdown-body kbd,
  .markdown-body pre,
  .markdown-body samp {
    font-family: monospace;
    font-size: 1em;
  }

  .markdown-body figure {
    margin: 1em 40px;
  }

  .markdown-body hr {
    box-sizing: content-box;
    overflow: hidden;
    background: transparent;
    border-bottom: 1px solid #21262d;
    height: 0.25em;
    padding: 0;
    margin: 24px 0;
    background-color: #30363d;
    border: 0;
  }

  .markdown-body input {
    font: inherit;
    margin: 0;
    overflow: visible;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
  }

  .markdown-body a:hover {
    text-decoration: underline;
  }

  .markdown-body hr::before {
    display: table;
    content: '';
  }

  .markdown-body hr::after {
    display: table;
    clear: both;
    content: '';
  }

  .markdown-body table {
    border-spacing: 0;
    border-collapse: collapse;
    display: block;
    width: max-content;
    max-width: 100%;
    overflow: auto;
    margin: 1em 0;
  }

  .markdown-body td,
  .markdown-body th {
    padding: 0;
  }

  .markdown-body input[type='checkbox'] {
    accent-color: #58a6ff;
  }

  .markdown-body a:focus,
  .markdown-body [role='button']:focus,
  .markdown-body input[type='radio']:focus,
  .markdown-body input[type='checkbox']:focus {
    outline: 2px solid #58a6ff;
    outline-offset: -2px;
    box-shadow: none;
  }

  .markdown-body a:focus:not(:focus-visible),
  .markdown-body [role='button']:focus:not(:focus-visible),
  .markdown-body input[type='radio']:focus:not(:focus-visible),
  .markdown-body input[type='checkbox']:focus:not(:focus-visible) {
    outline: solid 1px transparent;
  }

  .markdown-body a:focus-visible,
  .markdown-body [role='button']:focus-visible,
  .markdown-body input[type='radio']:focus-visible,
  .markdown-body input[type='checkbox']:focus-visible {
    outline: 2px solid #58a6ff;
    outline-offset: -2px;
    box-shadow: none;
  }

  .markdown-body a:not([class]):focus,
  .markdown-body a:not([class]):focus-visible,
  .markdown-body input[type='radio']:focus,
  .markdown-body input[type='radio']:focus-visible,
  .markdown-body input[type='checkbox']:focus,
  .markdown-body input[type='checkbox']:focus-visible {
    outline-offset: 0;
  }

  .markdown-body kbd {
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
    line-height: 10px;
    color: #c9d1d9;
    vertical-align: middle;
    background-color: #161b22;
    border: solid 1px rgba(110, 118, 129, 0.4);
    border-bottom-color: rgba(110, 118, 129, 0.4);
    border-radius: 6px;
    box-shadow: inset 0 -1px 0 rgba(110, 118, 129, 0.4);
  }

  .markdown-body h1,
  .markdown-body h2,
  .markdown-body h3,
  .markdown-body h4,
  .markdown-body h5,
  .markdown-body h6 {
    margin: 0;
    line-height: 1;
  }

  .markdown-body h1 {
    font-weight: 600;
    padding: 10px 0 20px 0;
    font-size: ${(props) => props.theme.fontH1};
  }

  .markdown-body h2 {
    font-weight: 600;
    padding: 10px 0 20px 0;
    font-size: ${(props) => props.theme.fontH2};
  }

  .markdown-body h3 {
    font-weight: 600;
    padding: 10px 0 20px 0;
    font-size: ${(props) => props.theme.fontH3};
  }

  .markdown-body h4 {
    font-weight: 600;
    padding: 10px 0 20px 0;
    font-size: ${(props) => props.theme.fontH4};
  }

  .markdown-body h5 {
    font-weight: 600;
    padding: 6px 0 16px 0;
    font-size: ${(props) => props.theme.fontH5};
  }

  .markdown-body h6 {
    font-weight: 600;
    padding: 6px 0 16px 0;
    font-size: ${(props) => props.theme.fontH6};
  }

  .markdown-body p {
    margin-top: 0;
    margin-bottom: 10px;
  }

  .markdown-body blockquote {
    margin: 0;
    padding: 0 1em;
    color: #8b949e;
    border-left: 0.25em solid #30363d;
  }

  .markdown-body ul,
  .markdown-body ol {
    margin-top: 0;
    margin-bottom: 0;
    padding-left: 2em;
  }

  .markdown-body ol ol,
  .markdown-body ul ol {
    list-style-type: lower-roman;
  }

  .markdown-body ul ul ol,
  .markdown-body ul ol ol,
  .markdown-body ol ul ol,
  .markdown-body ol ol ol {
    list-style-type: lower-alpha;
  }

  .markdown-body dd {
    margin-left: 0;
  }

  .markdown-body tt,
  .markdown-body code,
  .markdown-body samp {
    font-family:
      ui-monospace,
      SFMono-Regular,
      SF Mono,
      Menlo,
      Consolas,
      Liberation Mono,
      monospace;
    font-size: 12px;
  }

  .markdown-body pre {
    margin-top: 0;
    margin-bottom: 0;
    font-family:
      ui-monospace,
      SFMono-Regular,
      SF Mono,
      Menlo,
      Consolas,
      Liberation Mono,
      monospace;
    font-size: 12px;
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

  .markdown-body > *:first-child {
    margin-top: 0 !important;
  }

  .markdown-body > *:last-child {
    margin-bottom: 0 !important;
  }

  .markdown-body a:not([href]) {
    color: inherit;
    text-decoration: none;
  }

  .markdown-body p,
  .markdown-body blockquote,
  .markdown-body ul,
  .markdown-body ol,
  .markdown-body dl,
  .markdown-body pre,
  .markdown-body details {
    margin-top: 0;
    margin-bottom: 16px;
  }

  .markdown-body blockquote > :first-child {
    margin-top: 0;
  }

  .markdown-body blockquote > :last-child {
    margin-bottom: 0;
  }

  .markdown-body h1 tt,
  .markdown-body h1 code,
  .markdown-body h2 tt,
  .markdown-body h2 code,
  .markdown-body h3 tt,
  .markdown-body h3 code,
  .markdown-body h4 tt,
  .markdown-body h4 code,
  .markdown-body h5 tt,
  .markdown-body h5 code,
  .markdown-body h6 tt,
  .markdown-body h6 code {
    padding: 0 0.2em;
    font-size: inherit;
  }

  .markdown-body ul ul,
  .markdown-body ul ol,
  .markdown-body ol ol,
  .markdown-body ol ul {
    margin-top: 0;
    margin-bottom: 0;
  }

  .markdown-body li > p {
    margin-top: 16px;
  }

  .markdown-body li + li {
    margin-top: 0.25em;
  }

  .markdown-body dl {
    padding: 0;
  }

  .markdown-body dl dt {
    padding: 0;
    margin-top: 16px;
    font-size: 1em;
    font-style: italic;
    font-weight: 600;
  }

  .markdown-body dl dd {
    padding: 0 16px;
    margin-bottom: 16px;
  }

  .markdown-body table th {
    font-weight: 600;
  }

  .markdown-body table th,
  .markdown-body table td {
    min-width: 60px;
    padding: 6px 20px;
  }

  .markdown-body table img {
    background-color: transparent;
  }

  .markdown-body img[align='right'] {
    padding-left: 20px;
  }

  .markdown-body img[align='left'] {
    padding-right: 20px;
  }

  .markdown-body code,
  .markdown-body tt {
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 85%;
    white-space: break-spaces;
    background-color: rgba(110, 118, 129, 0.4);
    border-radius: 6px;
  }

  .markdown-body code br,
  .markdown-body tt br {
    display: none;
  }

  .markdown-body del code {
    text-decoration: inherit;
  }

  .markdown-body samp {
    font-size: 85%;
  }

  .markdown-body pre code {
    font-size: 100%;
  }

  .markdown-body pre > code {
    padding: 0;
    margin: 0;
    word-break: normal;
    white-space: pre;
    background: transparent;
    border: 0;
  }

  .markdown-body pre {
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #161b22;
    border-radius: 6px;
  }

  .markdown-body pre code,
  .markdown-body pre tt {
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

  .markdown-body ul[data-task-list] {
    padding: 0;
    list-style-type: none;
  }

  .remirror-list-item-with-custom-mark {
    display: flex;
  }

  .remirror-list-item-marker-container {
    margin-right: 0.5em;
  }

  .markdown-body h1 .show {
    font-size: 2rem;
  }

  .markdown-body h2 .show {
    font-size: 1.5rem;
  }
  .markdown-body h3 .show {
    font-size: 1.25rem;
  }

  .markdown-body h4 .show {
    font-size: 1rem;
  }

  .markdown-body h5 .show {
    font-size: 0.875rem;
  }

  .markdown-body h6 .show {
    font-size: 0.85rem;
  }

  .markdown-body .md-img-uri,
  .markdown-body .md-img-text,
  .markdown-body .md-link {
    font-size: 0;
    letter-spacing: 0;
  }

  .markdown-body .md-html-inline {
    letter-spacing: 0;
    font-size: 0;
    background-color: ${(props) => props.theme.tipsBgColor};
    color: ${(props) => props.theme.labelFontColor};
  }

  .md-mark {
    color: ${(props) => props.theme.accentColor};
    font-size: 0;
  }
  .show {
    font-size: 16px;
  }

  .markdown-body .cm-editor {
    height: auto;
    padding: 8px 12px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: ${(props) => props.theme.bgColor};
    border: 1px solid ${(props) => props.theme.borderColor};
  }

  .cm-editor.cm-focused {
    outline: none; // override the default outline
  }

  & .code-block__reference {
    padding: 4px 1em;
    font-size: 0.8em;
    border: 1px solid ${(props) => props.theme.borderColor};
    background-color: ${(props) => props.theme.tipsBgColor};

    &--active {
      border-bottom: none;
    }
  }

  & .code-block__languages {
    font-size: 0.75em;
    max-height: 180px;
    list-style: none;
    padding: 0;
    margin: 0;
    width: 160px;
    background-color: ${(props) => props.theme.bgColor};
    border: 1px solid ${(props) => props.theme.borderColor};
    overflow: auto;
    box-sizing: border-box;
    z-index: 100;
    box-shadow:
      0 1px 4px -2px ${(props) => props.theme.boxShadowColor},
      0 2px 8px 0 ${(props) => props.theme.boxShadowColor},
      0 8px 16px 4px ${(props) => props.theme.boxShadowColor};

    &__input {
      height: 100%;
      width: 160px;
      outline: none;
      color: ${(props) => props.theme.accentColor};
      font-weight: 900;
      background-color: transparent;
      box-sizing: border-box;
      border: none;
    }
  }

  & .code-block__language {
    padding: 0.5em 1em;
    font-size: 1em;
    cursor: pointer;
    transition: all 0.3s;

    &--active {
      background-color: ${(props) => props.theme.borderColor};
    }

    &:hover {
      background-color: ${(props) => props.theme.tipsBgColor};
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
    transition: all 0.3s;
  }

  .html-node {
    position: relative;
    min-height: 40px;
    transition: all 0.3s;

    &:hover {
      background-color: ${({ theme }) => theme.tipsBgColor};
    }
  }

  .html-src {
    outline: none;
  }

  .ProseMirror-focused {
    outline: 2px solid ${(props) => props.theme.accentColor};
  }

  .img-input__container {
    display: flex;
  }

  .html-node-label {
    position: absolute;
    right: 0;
    opacity: 0;
    transition: all 0.3s;
    font-size: small;
    cursor: pointer;
    color: ${(props) => props.theme.labelFontColor};
  }

  .node-enter {
    & .html-node-render {
      background-color: ${({ theme }) => theme.tipsBgColor};
    }

    & .html-node-label {
      opacity: 1;
      background-color: ${({ theme }) => theme.tipsBgColor};
    }
  }

  .cm-editor {
    margin-bottom: 1em;
    line-height: ${(props) => props.theme.lineHeightBase};
    font-size: ${(props) => props.theme.fontBase};
    font-family: ${(props) => props.theme.codemirrorFontFamily} !important;

    .cm-line {
      padding: 2px 2px 2px 6px;

      span {
        line-height: ${(props) => props.theme.lineHeightBase};
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

    .cm-gutters {
      border: none;
    }

    .cm-gutter.cm-lineNumbers {
      color: ${(props) => props.theme.labelFontColor};
    }
  }
`
