import classNames from 'classnames'
import { memo, useMemo, useState } from 'react'
import { Container as SideBarContainer, SideBarHeader } from './styles'
import { Explorer } from '@/components'
import { RIGHTBARITEMKEYS } from '@/constants'
import chatgpt from '@/extensions/chatgpt'
import BookMarks from '@/extensions/bookmarks'
import { Search } from '@/extensions/search'
import { Tooltip } from 'zens'

function SideBar() {
  const [activeRightBarItemKey, setActiveRightBarItemKey] = useState<RIGHTBARITEMKEYS>(
    RIGHTBARITEMKEYS.Explorer,
  )

  const rightBarDataSource: RightBarItem[] = useMemo(() => {
    return [
      {
        title: RIGHTBARITEMKEYS.Explorer,
        key: RIGHTBARITEMKEYS.Explorer,
        icon: <i className='ri-file-list-3-line' />,
        components: <Explorer />,
      },
      Search,
      BookMarks,
      chatgpt,
    ]
  }, [])

  const activeRightBarItem = useMemo(() => {
    const activeItem = rightBarDataSource.find((item) => item.key === activeRightBarItemKey)
    return activeItem
  }, [activeRightBarItemKey, rightBarDataSource])

  const noActiveItem = !activeRightBarItemKey

  return (
    <SideBarContainer noActiveItem={noActiveItem}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        <SideBarHeader>
          {rightBarDataSource.map((item) => {
            const cls = classNames('icon', {
              'app-sidebar-active': activeRightBarItemKey === item.key,
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
