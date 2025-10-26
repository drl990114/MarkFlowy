import styled from 'styled-components'

type NodeContainerProps = {
  highlight: boolean
  selected: boolean
}

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
      : props.theme.primaryFontColor};
  background-color: ${(props) =>
    props.highlight
      ? props.theme.accentColorFocused
      : props.selected
        ? props.theme.fileTreeSelectedBgColor
        : 'transparent'};
  border: 1px solid
    ${(props) => (props.selected ? props.theme.borderColorFocused : 'transparent')};
  box-sizing: border-box;

  &:hover {
    background-color: ${(props) => props.theme.fileTreeSelectedBgColor};
  }

  .file-icon {
    flex-shrink: 0;
    margin-right: 4px;
  }
`
