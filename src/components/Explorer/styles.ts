import styled from 'styled-components'
import colors from 'windicss/colors'

export const Container = styled.div`
  min-width: calc(100% - 48px);

  .border-t-1-solid {
    border-top: 1px solid ${colors.zinc[200]};
  }

  .border-b-1-solid {
    border-bottom: 1px solid ${colors.zinc[200]};
  }
`
