import styled from 'styled-components'

export const Container = styled.div`
  position: relative;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: ${(props) => props.theme.statusBarHeight};
  background: ${(props) => props.theme.statusBarBgColor};
  user-select: none;
  font-size: 0.8rem;
`

export const LeftContainer = styled.div`
  position: relative;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  height: ${(props) => props.theme.statusBarHeight};
  background: ${(props) => props.theme.statusBarBgColor};
  user-select: none;
  font-size: 0.8rem;
`

export const RightContainer = styled.div`
  position: relative;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  height: ${(props) => props.theme.statusBarHeight};
  background: ${(props) => props.theme.statusBarBgColor};
  user-select: none;
  font-size: 0.8rem;
`
