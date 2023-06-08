import styled from 'styled-components'

export const Container = styled.div`
  min-width: calc(100% - 48px);

  .border-t-1-solid {
    border-top: 1px solid ${(props) => props.theme.borderColor};
  }

  .border-b-1-solid {
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
  }
`
