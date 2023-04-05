import { useCallback, useEffect, useRef, useState } from 'react'
import { Explorer } from '@components'
import { Container } from './styles'
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
    <Container ref={sidebarRef} className="app-sidebar" style={{ width: sidebarWidth }} onMouseDown={e => e.preventDefault()}>
      <Explorer className="app-sidebar-content" />
      <div className="app-sidebar-resizer bg-borderDefault" onMouseDown={startResizing} />
    </Container>
  )
}

export default SideBar
