import styled from 'styled-components'

export const Container = styled.div`
  position: relative;
  top: 0;
  left: 0;
  right: 0;
  padding: 0 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${(props) => props.theme.spaceSm};
  height: ${(props) => props.theme.statusBarHeight};
  background: ${(props) => props.theme.statusBarBgColor};
  border-top: 1px solid ${(props) => props.theme.borderColor};
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
  gap: ${(props) => props.theme.spaceSm};
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
  gap: ${(props) => props.theme.spaceSm};
  height: ${(props) => props.theme.statusBarHeight};
  background: ${(props) => props.theme.statusBarBgColor};
  user-select: none;
  font-size: 0.8rem;
`
