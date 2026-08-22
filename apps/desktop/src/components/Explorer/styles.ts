import styled from 'styled-components'

export const EXPLORER_FILE_TREE_INDENT_SIZE = 20
export const EXPLORER_FILE_TREE_ROW_HEIGHT = 26

export const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  user-select: none;
  overflow: hidden;
  font-size: var(--mf-ui-font-control);
  line-height: var(--mf-ui-line-height-control);
  letter-spacing: var(--mf-ui-tracking-control);

  && .mf-file-tree-item > [data-mf-file-tree-node] {
    width: 100%;
    align-items: stretch;
    border-right-width: 2px;
    background-color: transparent;
  }

  && .mf-file-tree-item > [data-mf-file-tree-node] > .mf-file-tree-row {
    background-color: transparent;
  }

  && .mf-file-tree-item:hover > [data-mf-file-tree-node] {
    background-color: var(
      --mf-ui-control-hover-bg,
      ${(props) => props.theme.hoverColor}
    );
  }

  && .mf-file-tree-item:focus-visible {
    outline: none;
  }

  && .mf-file-tree-item:focus-visible > [data-mf-file-tree-node] {
    border-color: var(--mf-control-focus, ${(props) => props.theme.accentColor});
  }

  && .mf-file-tree-item[aria-selected='true'] > [data-mf-file-tree-node],
  && .mf-file-tree-item[aria-selected='true']:hover > [data-mf-file-tree-node] {
    background-color: var(
      --mf-ui-control-hover-bg,
      ${(props) => props.theme.hoverColor}
    );
  }

  &&
    .mf-file-tree-item
    > [data-mf-file-tree-node][data-mf-file-tree-drop-highlight='true'] {
    background-color: var(--mf-primary-soft, ${(props) => props.theme.accentColorFocused});
  }

  && .mf-file-tree-row {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0 6px;
    border-radius: 0;
    font-size: var(--mf-ui-font-body);
    font-weight: 400;
    line-height: var(--mf-line-height);
    letter-spacing: var(--mf-ui-tracking-body);
  }

  && .mf-file-tree-row .file-icon {
    font-size: 16px;
  }

  && .mf-file-tree-row .mf-file-tree-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    line-height: 0;
  }

  && .mf-file-tree-row .mf-file-tree-icon svg {
    width: 16px;
    height: 16px;
  }

  && .mf-file-tree-row .mf-file-tree-name-input {
    height: 24px;
    padding: 0 6px;
    font-size: var(--mf-ui-font-body);
    line-height: var(--mf-ui-line-height-body);
  }

  .border-t-1-solid {
    border-top: 1px solid ${(props) => props.theme.borderColor};
  }

  .border-b-1-solid {
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
  }
`
