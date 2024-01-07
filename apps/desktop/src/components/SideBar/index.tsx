import classNames from 'classnames'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Container as SideBarContainer, SideBarHeader } from './styles'
import { Explorer } from '@/components'
import { RIGHTBARITEMKEYS } from '@/constants'
import { useCommandStore } from '@/stores'
import chatgpt from '@/extensions/chatgpt'
import BookMarks from '@/extensions/bookmarks'
import { TableOfContent } from '@/extensions/table-of-content'
import { Search } from '@/extensions/search'

function SideBar() {
  const [isResizing, setIsResizing] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [activeRightBarItemKey, setActiveRightBarItemKey] = useState<RIGHTBARITEMKEYS>(
    RIGHTBARITEMKEYS.Explorer,
  )
  // TODO need local cache
  const [visible, setVisible] = useState(true)
  const { addCommand } = useCommandStore()
  const sidebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    addCommand({ id: 'app:toggle_sidebar', handler: () => setVisible((v) => !v) })
  }, [addCommand])

  const rightBarDataSource: RightBarItem[] = useMemo(() => {
    return [
      {
        title: RIGHTBARITEMKEYS.Explorer,
        key: RIGHTBARITEMKEYS.Explorer,
        icon: <i className='ri-file-list-3-line' />,
        components: <Explorer />,
      },
      Search,
      TableOfContent,
      BookMarks,
      chatgpt,
    ]
  }, [])

  const activeRightBarItem = useMemo(() => {
    const activeItem = rightBarDataSource.find((item) => item.key === activeRightBarItemKey)
    return activeItem
  }, [activeRightBarItemKey, rightBarDataSource])

  const startResizing = useCallback((e: { preventDefault: () => void }) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing && sidebarRef.current) {
        const sideBarClientRect = sidebarRef.current.getBoundingClientRect()
        if (
          sideBarClientRect.width > 100 &&
          mouseMoveEvent.clientX - sideBarClientRect.left <= 100
        ) {
          setVisible(false)
        } else if (
          sideBarClientRect.width < 100 &&
          mouseMoveEvent.clientX - sideBarClientRect.left > 100
        ) {
          setVisible(true)
        }

        requestAnimationFrame(() => {
          setSidebarWidth(mouseMoveEvent.clientX - sideBarClientRect.left)
        })
      }
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
    <SideBarContainer
      ref={sidebarRef}
      noActiveItem={noActiveItem}
      style={{ width: visible ? Math.max(sidebarWidth, 100) : 0 }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <SideBarHeader>
          {rightBarDataSource.map((item) => {
            const cls = classNames('icon', {
              'app-sidebar-active': activeRightBarItemKey === item.key,
            })

            const handleRightBarItemClick = () => {
              setActiveRightBarItemKey(item.key)
            }

            return (
              <div key={item.key} className={cls} onClick={handleRightBarItemClick}>
                {item.icon}
              </div>
            )
          })}
        </SideBarHeader>
        {activeRightBarItem?.components ?? null}
      </div>
      <div className='app-sidebar-resizer' onMouseDown={startResizing} />
    </SideBarContainer>
  )
}

export interface RightBarItem {
  title: RIGHTBARITEMKEYS
  key: RIGHTBARITEMKEYS
  icon: React.ReactNode
  components: any
}

export default memo(SideBar)
