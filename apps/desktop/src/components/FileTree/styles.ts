import { colorAdaptiveChange } from '@/helper/theme'
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
  background-color: ${(props) =>
    props.highlight ? colorAdaptiveChange(props.theme.bgColor, 0.6, 0.2) : 'transparent'};
  border: 1px dashed transparent;

  &:hover {
    /* background-color: ${(props) => props.theme.borderColor}; */
    border: 1px dashed ${(props) => props.theme.accentColor};
  }

  .file-icon {
    flex-shrink: 0;
    margin-right: 4px;
  }
`
