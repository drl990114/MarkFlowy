import styled, { createGlobalStyle } from 'styled-components'

export const OverlayScrollbarStyles = createGlobalStyle`
  .os-theme-markflowy {
    box-sizing: border-box;
    --os-size: 8px;
    --os-padding-perpendicular: 2px;
    --os-padding-axis: 2px;
    --os-track-border-radius: 4px;
    --os-handle-border-radius: 4px;
    --os-handle-interactive-area-offset: 4px;

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
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;

  .editor-area-header {
    display: flex;
    flex: initial;
    align-items: center;
    justify-content: flex-end;
    box-sizing: border-box;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    border-left: 1px solid ${(props) => props.theme.borderColor};
  }

  .code-contents {
    flex: 1;
    display: flex;
    padding-top: ${(props) => props.theme.spaceSm};
  }
`

export const TabItem = styled.div<TabItemProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  top: 1px;
  padding-left: ${(props) => props.theme.spaceXl};
  padding-right: ${(props) => props.theme.spaceXs};
  font-size: ${(props) => props.theme.fontXs};
  border-left: 1px solid ${(props) => props.theme.borderColor};
  background-color: ${(props) =>
    props.active ? props.theme.editorTabActiveBgColor : props.theme.editorTabBgColor};
  border-bottom: 2px solid
    ${(props) => (props.active ? props.theme.editorTabActiveBgColor : props.theme.borderColor)};
  box-sizing: border-box;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* Edge, IE */

  &:first-child {
    border-left: none;
  }

  .close {
    cursor: pointer;
    opacity: 0;
  }

  &:hover {
    .close {
      opacity: 1;
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
  active: boolean
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
  position: relative;
`

export const EditorScrollContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: auto;
`
