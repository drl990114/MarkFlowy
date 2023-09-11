import classNames from 'classnames'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Container as SideBarContainer, SettingRightBarContainer, SideBar as SideBarWrapper } from './styles'
import chatgpt from '@/chatgpt'
import { Explorer, Setting } from '@/components'
import { RIGHTBARITEMKEYS } from '@/constants'
import { useCommandStore } from '@/stores'
import BookMarks from '@/bookmarks'
import { TableOfContent } from '../Toc'

function SideBar() {
  const [isResizing, setIsResizing] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [activeRightBarItemKey, setActiveRightBarItemKey] = useState<RIGHTBARITEMKEYS | undefined>()
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
          setActiveRightBarItemKey(undefined)
        } else if (
          sideBarClientRect.width < 100 &&
          mouseMoveEvent.clientX - sideBarClientRect.left > 100
        ) {
          setActiveRightBarItemKey(rightBarDataSource[0].key)
        }

        requestAnimationFrame(() => {
          setSidebarWidth(mouseMoveEvent.clientX - sideBarClientRect.left)
        })
      }
    },
    [isResizing, rightBarDataSource],
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
      style={{ width: noActiveItem ? (visible ? '48px' : 0) : sidebarWidth }}
    >
      <SideBarWrapper visible={visible}>
        <div>
          {rightBarDataSource.map((item) => {
            const cls = classNames('app-sidebar__item fjic', {
              'app-sidebar-active': activeRightBarItemKey === item.key,
            })

            const handleRightBarItemClick = () => {
              if (activeRightBarItemKey === item.key) setActiveRightBarItemKey(undefined)
              else setActiveRightBarItemKey(item.key)
            }

            return (
              <div key={item.key} className={cls} onClick={handleRightBarItemClick}>
                {item.icon}
              </div>
            )
          })}
        </div>
        <SettingRightBarContainer className='app-sidebar__item fjic'>
          <Setting />
        </SettingRightBarContainer>
      </SideBarWrapper>
      {activeRightBarItem?.components ?? null}
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
