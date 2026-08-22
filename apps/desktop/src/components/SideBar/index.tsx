import { Explorer } from '@/components'
import { AsyncSurface } from '@/components/AsyncSurface'
import type { RIGHTBARITEMKEYS } from '@/constants'
import { useTranslation } from '@/i18n'
import useLayoutStore from '@/stores/useLayoutStore'
import { lazy, memo, Suspense, type ReactNode } from 'react'
import { Container as SideBarContainer, DockPanelBody } from './styles'

const SearchExtension = lazy(async () => {
  const { Search } = await import('@/extensions/search')
  return { default: () => <>{Search.components}</> }
})

const BookMarksExtension = lazy(async () => {
  const { default: BookMarks } = await import('@/extensions/bookmarks')
  return { default: () => <>{BookMarks.components}</> }
})

function SideBar() {
  const { t } = useTranslation()
  const activePanelId = useLayoutStore((state) => state.leftBar.activePanelId)

  const lazyFallback = (
    <AsyncSurface
      state={{ status: 'loading', label: t('common.fetching') }}
    >
      {() => null}
    </AsyncSurface>
  )

  let content
  if (activePanelId === 'search') {
    content = (
      <Suspense fallback={lazyFallback}>
        <SearchExtension />
      </Suspense>
    )
  } else if (activePanelId === 'bookmarks') {
    content = (
      <Suspense fallback={lazyFallback}>
        <BookMarksExtension />
      </Suspense>
    )
  } else {
    content = <Explorer />
  }

  return (
    <SideBarContainer $side='left' data-mf-dock-panel={activePanelId}>
      <DockPanelBody key={activePanelId}>{content}</DockPanelBody>
    </SideBarContainer>
  )
}

export default memo(SideBar)

/** @deprecated Dock rendering now uses DockPanelDefinition; retained for extension compatibility. */
export interface RightBarItem {
  title: RIGHTBARITEMKEYS
  key: RIGHTBARITEMKEYS
  icon: ReactNode
  components: ReactNode
}
