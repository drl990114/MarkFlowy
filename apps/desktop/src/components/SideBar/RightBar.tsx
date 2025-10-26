import { RIGHTBARITEMKEYS } from '@/constants'
import aiExtension from '@/extensions/ai'
import { TableOfContent } from '@/extensions/table-of-content'
import classNames from 'classnames'
import { memo, useMemo, useState } from 'react'
import { Tooltip } from 'zens'
import { Container as SideBarContainer, SideBarHeader } from './styles'

function RightBar() {
  const [activeRightBarItemKey, setActiveRightBarItemKey] = useState<RIGHTBARITEMKEYS>(
    RIGHTBARITEMKEYS.TableOfContent,
  )

  const rightBarDataSource: RightBarItem[] = useMemo(() => {
    return [
      TableOfContent,
      aiExtension,
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

export default memo(RightBar)
