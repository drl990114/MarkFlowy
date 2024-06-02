import styled from 'styled-components'

const TITLEBAR_HEIGHT = '32px'

export const Container = styled.div`
  position: relative;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: ${(props) => props.theme.titleBarHeight};
  background: ${(props) => props.theme.titleBarBgColor};
  padding: 0 3px;
  user-select: none;
  font-size: 0.8rem;
  z-index: 99999;

  .titlebar-text {
    margin: 8px 4px 0 4px;
    height: ${(props) => props.theme.titleBarHeight};
    flex: 1;
    text-align: center;
    line-height: ${TITLEBAR_HEIGHT};
    font-weight: 500;
    font-size: 14px;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    cursor: default;
  }
`
