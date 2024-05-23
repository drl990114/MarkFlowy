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
    props.highlight || props.selected ? props.theme.accentColor : props.theme.primaryFontColor};
  background-color: ${(props) => (props.highlight ? props.theme.borderColor : 'transparent')};

  &:hover {
    background-color: ${(props) => props.theme.borderColor};
  }

  .file-icon {
    flex-shrink: 0;
    margin-right: 4px;
  }

  ${(props) =>
    props.highlight &&
    `
    border: 1px dash ${props.theme.accentColor};
  `}
`
