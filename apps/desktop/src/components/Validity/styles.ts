import styled from 'styled-components'

export const Container = styled.div`
  .invalid-text {
    padding: 4px 0;
    font-size: 14px;
    color: ${(props) => props.theme.dangerColor};
  }
`
