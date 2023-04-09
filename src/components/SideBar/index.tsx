import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Explorer, Icon, Menu } from '@components'
import type { ICONSNAME } from '@constants'
import { RIGHTBARITEMKEYS } from '@constants'
import classNames from 'classnames'
import { Container, SettingRightBarContainer } from './styles'

function SideBar() {
  const [isResizing, setIsResizing] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [activeRightBarItemKey, setActiveRightBarItemKey] = useState(RIGHTBARITEMKEYS.Explorer)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const rightBarDataSource: RightBarItem[] = useMemo(() => {
    return [
      {
        title: RIGHTBARITEMKEYS.Explorer,
        key: RIGHTBARITEMKEYS.Explorer,
        icon: 'copy',
        components: Explorer,
      },
    ]
  }, [])

  const activeRightBarItem = useMemo(() => {
    const activeItem = rightBarDataSource.find(item => item.key === activeRightBarItemKey)
    return activeItem
  }, [activeRightBarItemKey, rightBarDataSource])

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
    <Container ref={sidebarRef} style={{ width: sidebarWidth }} onMouseDown={e => e.preventDefault()}>
      <div className="w-48px border-r-1px flex flex-col flex-shrink-0 justify-between">
        {rightBarDataSource.map((item) => {
          const cls = classNames('w-48px h-48px fjic cursor-pointer', {
            'border-l-4px border-accentColor': activeRightBarItemKey === item.key,
          })

          const handleRightBarItemClick = () => setActiveRightBarItemKey(item.key)
          return <div key={item.key} className={cls} onClick={handleRightBarItemClick}>
            <Icon name={item.icon} />
          </div>
        })}
        <SettingRightBarContainer className="w-48px h-48px fjic cursor-pointer">
          <Icon name="setting" />
          <Menu className="menu shadow-md  " menuGroup={[[{ title: 'setting', key: 'setting' }]]} />
        </SettingRightBarContainer>
      </div>
      {activeRightBarItem?.components ? <activeRightBarItem.components className="app-sidebar-content"/> : null}
      <div className="app-sidebar-resizer" onMouseDown={startResizing} />
    </Container>
  )
}

interface RightBarItem {
  title: RIGHTBARITEMKEYS
  key: RIGHTBARITEMKEYS
  icon: ICONSNAME
  components: React.FC
}

export default memo(SideBar)
