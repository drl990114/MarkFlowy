import { PageLayout } from '@/components/Layout'
import { Separator } from 'react-resizable-panels'
import styled from 'styled-components'

export const RootPageLayout = styled(PageLayout)`
  position: relative;
  width: 100%;
  height: 100%;
  border-top: 0;

  &[data-mf-zen-mode] {
    #root-left,
    #root-right,
    [data-mf-root-separator],
    [data-mf-dock-overlay],
    .app-status-bar {
      display: none !important;
    }

    #root-center {
      flex: 1 1 100% !important;
      width: 100%;
    }
  }
`

export const StyleSeparator = styled(Separator)`
  background-color: var(--mf-ui-border-subtle);
  cursor: col-resize !important;
  width: 1px;
  transition: background-color var(--mf-motion-duration-fast, 120ms)
    var(--mf-motion-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  position: relative;

  &[data-mf-hidden] {
    display: none;
  }

  &:focus {
    outline: 1px solid ${(props) => props.theme.accentColor};
  }

  &[data-separator='hover'] {
    background-color: ${(props) => props.theme.accentColor};
  }

  &[data-separator='active'] {
    background-color: ${(props) => props.theme.accentColor};
  }
`

export const DockOverlayContainer = styled.aside<{
  $side: 'left' | 'right'
  $visible: boolean
}>`
  position: absolute;
  z-index: var(--mf-layer-dock-overlay, 20);
  top: 0;
  bottom: var(--mf-ui-status-bar-height);
  ${(props) => (props.$side === 'left' ? 'left: 0;' : 'right: 0;')}
  display: flex;
  width: min(280px, calc(100vw - 16px));
  min-width: 0;
  overflow: hidden;
  background: ${(props) =>
    props.$side === 'right'
      ? `var(--mf-surface-panel-right, ${props.theme.rightBarBgColor})`
      : `var(--mf-surface-panel-left, ${props.theme.sideBarBgColor})`};
  border-${(props) => (props.$side === 'left' ? 'right' : 'left')}: 1px solid
    var(--mf-ui-border-subtle);
  box-shadow: 0 12px 32px color-mix(in srgb, var(--mf-text-primary) 14%, transparent);
  opacity: ${(props) => (props.$visible ? 1 : 0)};
  visibility: ${(props) => (props.$visible ? 'visible' : 'hidden')};
  pointer-events: ${(props) => (props.$visible ? 'auto' : 'none')};
  transform: translateX(
    ${(props) => (props.$visible ? '0' : props.$side === 'left' ? '-100%' : '100%')}
  );
  transition:
    transform var(--mf-motion-duration-base, 180ms)
      var(--mf-motion-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
    opacity var(--mf-motion-duration-fast, 120ms)
      var(--mf-motion-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
    visibility 0s linear ${(props) => (props.$visible ? '0s' : '180ms')};
  will-change: transform, opacity;

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition:
      opacity var(--mf-motion-duration-fast, 120ms) linear,
      visibility 0s linear ${(props) => (props.$visible ? '0s' : '120ms')};
  }
`
