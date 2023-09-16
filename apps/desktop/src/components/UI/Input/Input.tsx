import styled from 'styled-components'

export const Input = styled.input`
  height: unset;
  min-width: 0;
  line-height: 22px;
  padding: 6px 4px 6px 5px;
  border: 1px solid;
  color: ${(props) => props.theme.primaryFontColor};
  border-color: ${(props) => props.theme.borderColor};
  background-color: ${(props) => props.theme.bgColor};
  border-radius: 4px;

  &:focus {
    outline: 2px solid ${(props) => props.theme.accentColor};
  }

  &[data-disabled='true'] {
    background-color: ${(props) => props.theme.tipsBgColor};
    cursor: not-allowed;
  }
`
