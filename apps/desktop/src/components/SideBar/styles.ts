import styled from 'styled-components'

export const Container = styled.div<{ $side: 'left' | 'right' }>`
  flex-grow: 0;
  flex-shrink: 0;
  height: 100%;
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  background: ${(props) =>
    props.$side === 'right'
      ? `var(--mf-surface-panel-right, ${props.theme.rightBarBgColor})`
      : `var(--mf-surface-panel-left, ${props.theme.sideBarBgColor})`};
  color: ${(props) => props.theme.primaryFontColor};
  overflow: hidden;
`

export const DockPanelBody = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  width: 100%;
  opacity: 1;
  animation: mf-dock-content-in 100ms var(--mf-motion-ease-out, ease-out);

  @keyframes mf-dock-content-in {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 1ms;
  }
`
