import { Panel } from 'react-resizable-panels'
import styled from 'styled-components'

export const Container = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`

export const LeftPanel = styled(Panel)`
  border-right: 1px solid ${(props) => props.theme.borderColor};
`

export const RightPanel = styled(Panel)`
  border-left: 1px solid ${(props) => props.theme.borderColor};
`
