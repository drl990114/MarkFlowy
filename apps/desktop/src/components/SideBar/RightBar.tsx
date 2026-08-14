import { RIGHTBARITEMKEYS } from '@/constants'
import { lazy, memo, Suspense, useMemo, useState } from 'react'
import { Container as SideBarContainer, SideBarHeader } from './styles'
import { SideBarModeButton } from './SideBarModeButton'

const TableOfContentExtension = lazy(async () => {
  const { default: TABLEOFCONTENT } = await import('@/extensions/table-of-content')
  return { default: () => <>{TABLEOFCONTENT.components}</> }
})

const AIExtension = lazy(async () => {
  const { default: aiExtension } = await import('@/extensions/ai')
  return { default: () => <>{aiExtension.components}</> }
})

function RightBar() {
  const [activeRightBarItemKey, setActiveRightBarItemKey] = useState<RIGHTBARITEMKEYS>(
    RIGHTBARITEMKEYS.TableOfContent,
  )

  const rightBarDataSource: RightBarItem[] = useMemo(() => {
    return [
      {
        title: RIGHTBARITEMKEYS.TableOfContent,
        key: RIGHTBARITEMKEYS.TableOfContent,
        icon: <i aria-hidden='true' className='ri-list-unordered' />,
        components: (
          <Suspense fallback={null}>
            <TableOfContentExtension />
          </Suspense>
        ),
      },
      {
        title: RIGHTBARITEMKEYS.AI,
        key: RIGHTBARITEMKEYS.AI,
        icon: <i aria-hidden='true' className='ri-chat-smile-ai-line' />,
        components: (
          <Suspense fallback={null}>
            <AIExtension />
          </Suspense>
        ),
      },
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
          {rightBarDataSource.map((item) => (
            <SideBarModeButton
              active={activeRightBarItemKey === item.key}
              icon={item.icon}
              key={item.key}
              label={item.title}
              onClick={() => setActiveRightBarItemKey(item.key)}
            />
          ))}
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
  components: React.ReactNode
}

export default memo(RightBar)
