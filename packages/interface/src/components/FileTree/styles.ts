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
          ? `color-mix(in srgb, ${props.theme.fileTreeSelectedBgColor} 82%, transparent)`
          : 'transparent'};
    box-sizing: border-box;
  }

  &:hover > .mf-file-tree-row {
    background-color: ${(props) =>
      props.selected
        ? `color-mix(in srgb, ${props.theme.fileTreeSelectedBgColor} 82%, transparent)`
        : `color-mix(in srgb, ${props.theme.hoverColor} 86%, transparent)`};
  }

  &:hover {
    color: ${(props) => props.theme.primaryFontColor};
  }

  .file-icon {
    flex-shrink: 0;
    margin-right: 4px;
  }
`
