import { useCallback, useEffect, useRef, useState } from 'react'
import { Explorer } from '@components'

function SideBar() {
  const [isResizing, setIsResizing] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(268)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const startResizing = useCallback(() => {
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing && sidebarRef.current)
        setSidebarWidth(mouseMoveEvent.clientX - sidebarRef.current.getBoundingClientRect().left)
    },
    [isResizing],
  )

  useEffect(() => {
    window.addEventListener('mousemove', resize)
    window.addEventListener('mouseup', stopResizing)
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [resize, stopResizing])

  return (
    <div ref={sidebarRef} className="app-sidebar" style={{ width: sidebarWidth }} onMouseDown={e => e.preventDefault()}>
      <Explorer className="app-sidebar-content" />
      <div className="app-sidebar-resizer" onMouseDown={startResizing} />
    </div>
  )
}

export default SideBar
