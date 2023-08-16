import styled from 'styled-components'

export const StyledInput = styled.input`
  height: unset;
  line-height: 22px;
  padding: 2px 6px;
  border: 1px solid;
  color: ${(props) => props.theme.primaryFontColor};
  border-color: ${(props) => props.theme.borderColor};
  background-color: ${(props) => props.theme.bgColor};
  border-radius: 4px;

  &[data-disabled='true'] {
    background-color: ${(props) => props.theme.tipsBgColor};
    cursor: not-allowed;
  }
`
