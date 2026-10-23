import { useEffect } from 'react'
import { clearDockDrag, useDockDragStore } from './dockDragData'

export function DockDragLifecycle() {
  const dragging = useDockDragStore((state) => state.panelId !== null)
  useEffect(() => {
    if (!dragging) return
    // Leaving the window does not finish a native drag. Keep the targets ready
    // if the pointer returns; dragend also fires after a drop outside the app.
    window.addEventListener('dragend', clearDockDrag)
    window.addEventListener('drop', clearDockDrag)
    window.addEventListener('blur', clearDockDrag)
    return () => {
      window.removeEventListener('dragend', clearDockDrag)
      window.removeEventListener('drop', clearDockDrag)
      window.removeEventListener('blur', clearDockDrag)
    }
  }, [dragging])
  useEffect(() => clearDockDrag, [])
  return null
}
