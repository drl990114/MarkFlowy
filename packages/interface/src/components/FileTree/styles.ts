import styled, { keyframes } from 'styled-components'

type NodeContainerProps = {
  highlight: boolean
  selected: boolean
}

const fileTreeSpin = keyframes`
  to {
    transform: rotate(360deg);
  }
`

export const LoadingIcon = styled.i`
  display: inline-block;
  width: 1em;
  height: 1em;
  line-height: 1;
  animation: ${fileTreeSpin} 0.8s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const EmptyFolderStatus = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 5px;
  margin-left: 8px;
  color: ${(props) => props.theme.labelFontColor};
  font-size: ${(props) => props.theme.fontXs};
  line-height: 1;

  &::before {
    width: 3px;
    height: 3px;
    border-radius: 9999px;
    background: currentColor;
    content: '';
    opacity: 0.7;
  }
`

/**
 * Structural viewport used only when a host opts into the pinned workspace root.
 * The virtualized list keeps ownership of scrolling; this wrapper only provides
 * a stable containing block for the duplicated root row.
 */
export const FileTreeStickyViewport = styled.div`
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`

export const FileTreeStickyRoot = styled.div`
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  left: 0;
  height: 24px;
  background: var(
    --mf-surface-panel-left,
    var(--mf-surface-panel, ${(props) => props.theme.sideBarBgColor})
  );
  box-shadow: 0 1px 0 var(--mf-ui-border-subtle, ${(props) => props.theme.borderColor});

  > [data-mf-file-tree-sticky-item] {
    outline: none;
  }

  > [data-mf-file-tree-sticky-item]:focus-visible {
    outline: 1px solid var(--mf-control-focus, ${(props) => props.theme.accentColor});
    outline-offset: -1px;
  }
`

export const NodeContainer = styled.div<NodeContainerProps>`
  font-size: ${(props) => props.theme.fontSm};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  cursor: default;
  height: 100%;
  color: ${(props) =>
    props.highlight || props.selected
      ? props.theme.primaryFontColor
      : props.theme.unselectedFontColor};
  background-color: transparent;
  border: 1px solid transparent;
  box-sizing: border-box;

  > .mf-file-tree-row {
    display: flex;
    align-items: center;
    width: calc(100% - 8px);
    height: calc(100% - 2px);
    margin: 1px 4px;
    padding: 0 6px;
    border-radius: ${(props) => props.theme.smallBorderRadius};
    background-color: ${(props) =>
      props.highlight
        ? props.theme.accentColorFocused
        : props.selected
          ? `color-mix(in srgb, ${props.theme.hoverColor} 86%, transparent)`
          : 'transparent'};
    box-sizing: border-box;
  }

  &:hover > .mf-file-tree-row {
    background-color: ${(props) =>
      `color-mix(in srgb, ${props.theme.hoverColor} 86%, transparent)`};
  }

  &:hover {
    color: ${(props) => props.theme.primaryFontColor};
  }

  .file-icon {
    flex-shrink: 0;
    margin-right: 4px;
  }

  .mf-file-tree-name-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 4px;
    font: inherit;
  }
`
