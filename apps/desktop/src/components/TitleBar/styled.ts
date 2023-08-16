import { TITLEBAR_HEIGHT } from '@/constants/styled'
import styled from 'styled-components'

export const TitleBarBg = styled.div`
  height: ${TITLEBAR_HEIGHT};
  background: ${(props) => props.theme.bgColor};
  position: relative;
  left: 0;
  top: 0;
  right: 0;
`

export const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  height: ${TITLEBAR_HEIGHT};
  padding: 0 3px;
  user-select: none;
  background: transparent;
  font-size: 0.8rem;
  z-index: 99999;

  .titlebar-text {
    flex-grow: 1;
    text-align: center;
    line-height: ${TITLEBAR_HEIGHT};
    font-weight: 600;
    font-size: 12px;
    color: ${(props) => props.theme.labelFontColor};
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    cursor: default;
  }
`
