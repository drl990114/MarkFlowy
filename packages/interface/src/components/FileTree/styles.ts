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
  background-color: ${(props) =>
    props.highlight
      ? props.theme.accentColorFocused
      : props.selected
        ? props.theme.fileTreeSelectedBgColor
        : 'transparent'};
  border: 1px solid ${(props) => (props.selected ? props.theme.borderColorFocused : 'transparent')};
  box-sizing: border-box;

  &:hover {
    background-color: ${(props) => props.theme.fileTreeSelectedBgColor};
    color: ${(props) => props.theme.primaryFontColor};
  }

  .file-icon {
    flex-shrink: 0;
    margin-right: 4px;
  }
`
