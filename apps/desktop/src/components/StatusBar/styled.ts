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
  height: var(--mf-ui-status-bar-height);
  background: ${(props) => props.theme.statusBarBgColor};
  border-top: 1px solid var(--mf-ui-border-subtle);
  user-select: none;
  font-size: var(--mf-ui-font-caption);
  line-height: var(--mf-ui-line-height-caption);
  letter-spacing: var(--mf-ui-tracking-caption);
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
  height: var(--mf-ui-status-bar-height);
  background: ${(props) => props.theme.statusBarBgColor};
  user-select: none;
  font-size: inherit;
  line-height: inherit;
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
  height: var(--mf-ui-status-bar-height);
  background: ${(props) => props.theme.statusBarBgColor};
  user-select: none;
  font-size: inherit;
  line-height: inherit;
`
