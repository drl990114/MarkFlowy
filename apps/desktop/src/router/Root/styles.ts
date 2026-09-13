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

  &:focus-visible {
    outline: none;
    background-color: ${(props) => props.theme.labelFontColor};
  }

  &[data-separator='hover'] {
    background-color: ${(props) => props.theme.accentColor};
  }

  &[data-separator='active'] {
    background-color: ${(props) => props.theme.accentColor};
  }
`
