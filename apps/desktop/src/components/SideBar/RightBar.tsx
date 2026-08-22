import { AsyncSurface } from '@/components/AsyncSurface'
import { useTranslation } from '@/i18n'
import useLayoutStore from '@/stores/useLayoutStore'
import { lazy, memo, Suspense } from 'react'
import { Container as SideBarContainer, DockPanelBody } from './styles'

const TableOfContentExtension = lazy(async () => {
  const { default: TABLEOFCONTENT } = await import('@/extensions/table-of-content')
  return { default: () => <>{TABLEOFCONTENT.components}</> }
})

const AIExtension = lazy(async () => {
  const { default: aiExtension } = await import('@/extensions/ai')
  return { default: () => <>{aiExtension.components}</> }
})

function RightBar() {
  const { t } = useTranslation()
  const activePanelId = useLayoutStore((state) => state.rightBar.activePanelId)
  const lazyFallback = (
    <AsyncSurface
      state={{ status: 'loading', label: t('common.fetching') }}
    >
      {() => null}
    </AsyncSurface>
  )

  return (
    <SideBarContainer $side='right' data-mf-dock-panel={activePanelId}>
      <DockPanelBody key={activePanelId}>
        {activePanelId === 'ai' ? (
          <Suspense fallback={lazyFallback}>
            <AIExtension />
          </Suspense>
        ) : (
          <Suspense fallback={lazyFallback}>
            <TableOfContentExtension />
          </Suspense>
        )}
      </DockPanelBody>
    </SideBarContainer>
  )
}

export default memo(RightBar)
