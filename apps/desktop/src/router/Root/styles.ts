import { PageLayout } from '@/components/Layout'
import { Separator } from 'react-resizable-panels'
import styled from 'styled-components'

export const RootPageLayout = styled(PageLayout)`
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
  background-color: ${(props) => props.theme.borderColor};
  cursor: col-resize !important;
  width: 1px;
  transition: all 0.2s ease;
  position: relative;

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
