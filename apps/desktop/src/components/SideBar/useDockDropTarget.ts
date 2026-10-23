import { useEffect, useState, type DragEvent } from 'react'
import type { DockSide } from '@/stores/useLayoutStore'
import { moveDockPanel } from './dockActions'
import {
  clearDockDrag,
  hasDockPanelDragData,
  readDockPanelDragData,
  useDockDragStore,
} from './dockDragData'

export function useDockDropTarget(side: DockSide, index?: number) {
  const [over, setOver] = useState(false)
  const dragging = useDockDragStore((state) => state.panelId !== null)
  useEffect(() => {
    if (!dragging) setOver(false)
  }, [dragging])
  return {
    over,
    handlers: {
      onDragOver(event: DragEvent<HTMLElement>) {
        if (!hasDockPanelDragData(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        setOver(true)
      },
      onDragLeave(event: DragEvent<HTMLElement>) {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOver(false)
      },
      onDrop(event: DragEvent<HTMLElement>) {
        if (!hasDockPanelDragData(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        const panelId = readDockPanelDragData(event.dataTransfer)
        setOver(false)
        clearDockDrag()
        if (panelId) moveDockPanel(panelId, side, index)
      },
    },
  }
}
