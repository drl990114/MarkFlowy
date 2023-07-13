import { TITLEBAR_HEIGHT } from '@/constants/styled'
import styled from 'styled-components'

export const Container = styled.div`
  height: calc(100vh - ${TITLEBAR_HEIGHT});
  display: flex;
  overflow: hidden;
`
