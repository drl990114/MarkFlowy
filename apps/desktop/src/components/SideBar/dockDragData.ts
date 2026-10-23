import { isDockPanelId, type DockPanelId } from '@/stores/useLayoutStore'
import { create } from 'zustand'

export const DOCK_PANEL_DRAG_TYPE = 'application/x-markflowy-dock-panel'

export const useDockDragStore = create<{ panelId: DockPanelId | null }>(() => ({ panelId: null }))

export function clearDockDrag(): void {
  useDockDragStore.setState({ panelId: null })
}

export function writeDockPanelDragData(dataTransfer: DataTransfer, panelId: DockPanelId): void {
  dataTransfer.effectAllowed = 'move'
  dataTransfer.setData(DOCK_PANEL_DRAG_TYPE, JSON.stringify({ panelId }))
  useDockDragStore.setState({ panelId })
}

export function hasDockPanelDragData(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(DOCK_PANEL_DRAG_TYPE)
}

export function readDockPanelDragData(dataTransfer: DataTransfer): DockPanelId | undefined {
  try {
    const data: unknown = JSON.parse(dataTransfer.getData(DOCK_PANEL_DRAG_TYPE))
    if (typeof data !== 'object' || data === null || !('panelId' in data)) return undefined
    return isDockPanelId(data.panelId) ? data.panelId : undefined
  } catch {
    return undefined
  }
}
