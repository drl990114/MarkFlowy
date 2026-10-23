import useLayoutStore, {
  getDockPanelSide,
  type DockPanelId,
  type DockSide,
} from '@/stores/useLayoutStore'

export function scheduleDockIconFocus(panelId: DockPanelId): void {
  window.requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>(`[data-mf-dock-panel-id="${panelId}"]`)
      ?.focus({ preventScroll: true })
  })
}

export function moveDockPanel(panelId: DockPanelId, side: DockSide, index?: number): void {
  useLayoutStore.getState().moveDockPanel(panelId, side, index)
  scheduleDockIconFocus(panelId)
}

export function moveDockPanelToOtherSide(panelId: DockPanelId): void {
  const side = getDockPanelSide(useLayoutStore.getState().panelOrder, panelId)
  moveDockPanel(panelId, side === 'left' ? 'right' : 'left')
}

export function resetDockLayout(panelId?: DockPanelId): void {
  useLayoutStore.getState().resetDockLayout()
  if (panelId) scheduleDockIconFocus(panelId)
}
