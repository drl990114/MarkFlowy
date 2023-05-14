import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Explorer, Icon, Setting } from '@components'
import type { ICONSNAME } from '@constants'
import { RIGHTBARITEMKEYS } from '@constants'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import { Container, SettingRightBarContainer } from './styles'

function SideBar() {
  const { t } = useTranslation()
  const [isResizing, setIsResizing] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [activeRightBarItemKey, setActiveRightBarItemKey] = useState<RIGHTBARITEMKEYS | undefined>(RIGHTBARITEMKEYS.Explorer)
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

  const noActiveItem = !activeRightBarItemKey

  return (
    <Container ref={sidebarRef} noActiveItem={noActiveItem} style={{ width: noActiveItem ? '48px' : sidebarWidth }} onMouseDown={e => e.preventDefault()}>
      <div className="app-sidebar w-48px flex flex-col flex-shrink-0 justify-between">
        {rightBarDataSource.map((item) => {
          const cls = classNames('w-48px h-48px fjic cursor-pointer', {
            'app-sidebar-active': activeRightBarItemKey === item.key,
          })

          const handleRightBarItemClick = () => {
            if (activeRightBarItemKey === item.key) {
              setActiveRightBarItemKey(undefined)
            } else {
              setActiveRightBarItemKey(item.key)
            }
          }

          return <div key={item.key} className={cls} onClick={handleRightBarItemClick}>
            <Icon name={item.icon} />
          </div>
        })}
        <SettingRightBarContainer className="w-48px h-48px fjic cursor-pointer">
          <Setting />
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
  components: React.FC<any>
}

export default memo(SideBar)
