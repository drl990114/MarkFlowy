import { PageLayout } from '@/components/Layout'
import { Separator } from 'react-resizable-panels'
import styled from 'styled-components'

export const RootPageLayout = styled(PageLayout)`
  position: relative;
  width: 100%;
  height: 100%;
  border-top: 0;

  @supports selector(:has([aria-expanded='true'])) {
    @media (hover: hover) and (pointer: fine) {
      &[data-mf-single-document] {
        /* Keep editor stacking below the toolbar without raising it above portals. */
        > [data-group] {
          isolation: isolate;

          /* Fullscreen previews must still cover the title bar outside Root. */
          body.mf-livepreview-fullscreen-active & {
            isolation: auto;
          }
        }

        > .app-status-bar {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: var(--mf-ui-status-bar-height);
          pointer-events: none;

          /* Overlay the full-height editor and docks; observe pointer proximity
             from Root so the hidden toolbar does not intercept editor input. */
          > [role='toolbar'] {
            position: absolute;
            top: auto;
            bottom: 0;
            opacity: 0;
            pointer-events: none;
          }

          &[data-mf-status-bar-hover] > [role='toolbar'],
          &:focus-within > [role='toolbar'],
          &:has([aria-expanded='true']) > [role='toolbar'] {
            opacity: 1;
            pointer-events: auto;
          }

          @media (prefers-reduced-motion: no-preference) {
            > [role='toolbar'] {
              transform: translateY(6px);
              transition:
                opacity var(--mf-motion-duration-fast, 100ms)
                  var(--mf-motion-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
                transform var(--mf-motion-duration-fast, 100ms)
                  var(--mf-motion-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
            }

            &[data-mf-status-bar-hover] > [role='toolbar'],
            &:focus-within > [role='toolbar'],
            &:has([aria-expanded='true']) > [role='toolbar'] {
              transform: translateY(0);
              transition-duration: var(--mf-motion-duration-overlay, 120ms),
                var(--mf-motion-duration-base, 180ms);
            }

            /* Focus and open menus need their final position immediately. */
            &:focus-within > [role='toolbar'],
            &:has([aria-expanded='true']) > [role='toolbar'] {
              transition: none;
            }
          }
        }
      }
    }
  }

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
    background-color: var(--mf-control-focus);
    box-shadow: 0 0 0 1px var(--mf-control-focus);
  }

  &[data-separator='hover'] {
    background-color: ${(props) => props.theme.accentColor};
  }

  &[data-separator='active'] {
    background-color: ${(props) => props.theme.accentColor};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`
