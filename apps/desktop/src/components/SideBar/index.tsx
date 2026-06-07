import { Explorer } from '@/components'
import { RIGHTBARITEMKEYS } from '@/constants'
import classNames from 'classnames'
import { lazy, memo, Suspense, useMemo, useState } from 'react'
import { Tooltip } from 'zens'
import { Container as SideBarContainer, SideBarHeader } from './styles'

const SearchExtension = lazy(async () => {
  const { Search } = await import('@/extensions/search')
  return { default: () => <>{Search.components}</> }
})

const BookMarksExtension = lazy(async () => {
  const { default: BookMarks } = await import('@/extensions/bookmarks')
  return { default: () => <>{BookMarks.components}</> }
})

function SideBar() {
  const [activeRightBarItemKey, setActiveRightBarItemKey] = useState<RIGHTBARITEMKEYS>(
    RIGHTBARITEMKEYS.Explorer,
  )

  const leftBarDataSource: RightBarItem[] = useMemo(() => {
    return [
      {
        title: RIGHTBARITEMKEYS.Explorer,
        key: RIGHTBARITEMKEYS.Explorer,
        icon: <i className='ri-file-list-3-line' />,
        components: <Explorer />,
      },
      {
        title: RIGHTBARITEMKEYS.Search,
        key: RIGHTBARITEMKEYS.Search,
        icon: <i className='ri-search-2-line' />,
        components: (
          <Suspense fallback={null}>
            <SearchExtension />
          </Suspense>
        ),
      },
      {
        title: RIGHTBARITEMKEYS.BookMarks,
        key: RIGHTBARITEMKEYS.BookMarks,
        icon: <i className='ri-bookmark-line' />,
        components: (
          <Suspense fallback={null}>
            <BookMarksExtension />
          </Suspense>
        ),
      },
    ]
  }, [])

  const activeRightBarItem = useMemo(() => {
    const activeItem = leftBarDataSource.find((item) => item.key === activeRightBarItemKey)
    return activeItem
  }, [activeRightBarItemKey, leftBarDataSource])

  const noActiveItem = !activeRightBarItemKey

  return (
    <SideBarContainer noActiveItem={noActiveItem}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        <SideBarHeader>
          {leftBarDataSource.map((item) => {
            const cls = classNames('icon', 'icon-small', 'icon-smooth', {
              'app-sidebar-active': activeRightBarItemKey === item.key,
              'icon-unselected': activeRightBarItemKey !== item.key
            })

            const handleRightBarItemClick = () => {
              setActiveRightBarItemKey(item.key)
            }

            return (
              <Tooltip key={item.key} title={item.title}>
                <div className={cls} onClick={handleRightBarItemClick}>
                  {item.icon}
                </div>
              </Tooltip>
            )
          })}
        </SideBarHeader>
        {activeRightBarItem?.components ?? null}
      </div>
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
