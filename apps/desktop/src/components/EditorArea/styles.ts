import styled, { createGlobalStyle } from 'styled-components'

export const OverlayScrollbarStyles = createGlobalStyle`
  /*
   * OverlayScrollbars defines its zero-value defaults on the os-scrollbar class.
   * Include that base class so this theme continues to win when the lazy
   * editor CSS chunk is injected after styled-components global styles.
   */
  .os-scrollbar.os-theme-markflowy {
    box-sizing: border-box;
    --os-size: 8px;
    --os-padding-perpendicular: 2px;
    --os-padding-axis: 2px;
    --os-track-border-radius: 4px;
    --os-handle-border-radius: 4px;
    --os-handle-interactive-area-offset: 4px;

    --os-track-bg: ${(props) => props.theme.scrollbarTrackColor};
    --os-track-bg-hover: ${(props) => props.theme.scrollbarTrackColor};
    --os-track-bg-active: ${(props) => props.theme.scrollbarTrackColor};
    --os-handle-bg: ${(props) => props.theme.scrollbarThumbColor};
    --os-handle-bg-hover: ${(props) => props.theme.scrollbarThumbColor};
    --os-handle-bg-active: ${(props) => props.theme.scrollbarThumbColor};
    --os-handle-perpendicular-size: 60%;
    --os-handle-perpendicular-size-hover: 80%;
    --os-handle-perpendicular-size-active: 80%;
  }

  /* When a live-preview block (mermaid/math/etc.) enters fullscreen mode,
     lower sidebars and status bar so the fixed-position fullscreen overlay
     is not obscured by them.
     The class 'mf-livepreview-fullscreen-active' is toggled on document.body
     via the mf:livepreview-fullscreen custom event dispatched by LivePreviewNodeView.

     react-resizable-panels Panel renders: <div data-panel id="panel-id"> */
  body.mf-livepreview-fullscreen-active {
    /* Hide sidebars and status bar via data attribute set by JS */
    [data-mf-hidden] {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    /* Hide editor area tabs & toolbars so they don't obscure the fullscreen overlay. */
    .editor-area-container > :not(#editor-panel) {
      display: none !important;
    }

    .editor-group-toolbar,
    .editor-area-tabs {
      display: none !important;
    }

    /* Break OverlayScrollbars stacking context so position: fixed
       can escape and cover the full viewport.
       .os-size-observer-host uses contain:strict which creates both
       a stacking context AND a containing block for fixed-position descendants */
    .os-size-observer-host,
    .os-viewport {
      contain: unset !important;
      transform: none !important;
      filter: none !important;
      backdrop-filter: none !important;
    }
  }
`

export const Container = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;

  .editor-area-header {
    display: flex;
    flex: initial;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    height: 32px;
    padding: 0 6px;
    box-sizing: border-box;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    border-left: 1px solid ${(props) => props.theme.borderColor};
  }

  .code-contents {
    flex: 1;
    display: flex;
    min-width: 0;
    width: 100%;
    padding-top: ${(props) => props.theme.spaceSm};
  }
`

export const TabItem = styled.div<TabItemProps>`
  display: flex;
  flex: 0 0 auto;
  justify-content: center;
  align-items: center;
  position: relative;
  height: 100%;
  padding-right: ${(props) => props.theme.spaceXs};
  font-size: var(--mf-ui-font-control);
  color: ${(props) =>
    props.$active
      ? 'var(--mf-text-primary, var(--mf-foreground))'
      : 'var(--mf-text-secondary, var(--mf-foreground-secondary))'};
  border-left: 1px solid var(--mf-ui-border-subtle);
  background-color: ${(props) =>
    props.$active
      ? props.theme.editorTabActiveBgColor
      : props.theme.editorTabBgColor};
  border-bottom: 1px solid
    ${(props) =>
      props.$active
        ? props.theme.editorTabActiveBgColor
        : 'var(--mf-ui-border-subtle)'};
  box-sizing: border-box;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* Edge, IE */

  &:hover {
    background-color: ${(props) =>
      props.$active
        ? props.theme.editorTabActiveBgColor
        : 'var(--mf-control-ghost-hover, var(--mf-ui-control-hover-bg))'};
  }

  &:focus-within {
    z-index: 1;
  }

  .tab-select {
    display: flex;
    min-width: 0;
    height: 100%;
    align-items: center;
    gap: 2px;
    padding: 0 0 0 ${(props) => props.theme.spaceXl};
    border: 0;
    color: inherit;
    background: transparent;
    cursor: pointer;
    font: inherit;
    white-space: inherit;
  }

  .tab-select:focus-visible {
    outline: 1px solid var(--mf-control-focus, ${(props) => props.theme.accentColor});
    outline-offset: -2px;
  }

  &:first-child {
    border-left: none;
  }

  .close {
    width: 22px;
    height: 22px;
    padding: 0;
    color: var(--mf-text-secondary, var(--mf-foreground-secondary));
    cursor: pointer;
    opacity: 0;
    transition:
      color var(--mf-motion-duration-fast, 120ms)
        var(--mf-motion-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
      opacity var(--mf-motion-duration-fast, 120ms)
      var(--mf-motion-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  }

  .close:hover {
    color: var(--mf-text-primary, var(--mf-foreground));
  }

  .close:active {
    background-color: var(--mf-control-ghost-pressed, var(--mf-control-selected));
    transform: none;
  }

  &:hover,
  &:focus-within {
    .close {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .close {
      transition-duration: 0ms;
    }
  }
`

type DotProps = {
  color?: string
}

export const Dot = styled.div<DotProps>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: ${(props) => props.color || props.theme.warnColor};
  margin: 0 0.25rem;
`

interface TabItemProps {
  $active: boolean
}

export const WarningHeader = styled.h3`
  text-align: center;
  color: ${(props) => props.theme.dangerColor};
`

export const EditorPanel = styled.div`
  flex: 1;
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  position: relative;
`

export const EditorScrollContainer = styled.div`
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  overflow-x: hidden;
  overflow-y: auto;

  [data-overlayscrollbars-contents] {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
`

export const EditorSkeleton = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px 32px;
  gap: 12px;

  .skeleton-line {
    height: 16px;
    border-radius: 4px;
    background-color: ${(props) => props.theme.borderColor};
    animation: skeleton-pulse 1.6s ease-in-out infinite;

    &:nth-child(odd) {
      width: 100%;
    }
    &:nth-child(even) {
      width: 85%;
    }

    @keyframes skeleton-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-line {
      animation: none;
    }
  }
`
