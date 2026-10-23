import Explorer from '@/components/Explorer'
import { AsyncSurface } from '@/components/AsyncSurface'
import { DeferredMount } from '@/components/DeferredMount'
import { useTranslation } from '@/i18n'
import useLayoutStore, { type DockSide } from '@/stores/useLayoutStore'
import { lazy, Suspense } from 'react'
import { Container, DockPanelBody } from './styles'
import { clearDockDrag, hasDockPanelDragData } from './dockDragData'

const SearchExtension = lazy(async () => {
  const { Search } = await import('@/extensions/search')
  return { default: () => <>{Search.components}</> }
})
const BookmarksExtension = lazy(async () => {
  const { default: extension } = await import('@/extensions/bookmarks')
  return { default: () => <>{extension.components}</> }
})
const OutlineExtension = lazy(async () => {
  const { default: extension } = await import('@/extensions/table-of-content')
  return { default: () => <>{extension.components}</> }
})
const AIExtension = lazy(async () => {
  const { default: extension } = await import('@/extensions/ai')
  return { default: () => <>{extension.components}</> }
})

export function DockPanelRenderer({ side }: { side: DockSide }) {
  const { t } = useTranslation()
  const dock = useLayoutStore((state) => (side === 'left' ? state.leftBar : state.rightBar))
  const zenMode = useLayoutStore((state) => state.zenModeActive)
  const visible = dock.visible && !zenMode
  const panelId = dock.activePanelId
  return (
    <Container
      $side={side}
      data-mf-dock-panel={panelId ?? undefined}
      onDragOverCapture={(event) => {
        if (!hasDockPanelDragData(event.dataTransfer)) return
        // Keep panel drags out of Explorer's native react-dnd listeners without
        // accepting a drop. Panels can only move through the bottom dock.
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'none'
      }}
      onDropCapture={(event) => {
        if (!hasDockPanelDragData(event.dataTransfer)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'none'
        clearDockDrag()
      }}
    >
      {panelId ? (
        <DockPanelBody key={panelId}>
          <DeferredMount visible={visible}>
            <Suspense
              fallback={
                <AsyncSurface state={{ status: 'loading', label: t('common.fetching') }}>
                  {() => null}
                </AsyncSurface>
              }
            >
              {panelId === 'explorer' ? (
                <Explorer />
              ) : panelId === 'search' ? (
                <SearchExtension />
              ) : panelId === 'bookmarks' ? (
                <BookmarksExtension />
              ) : panelId === 'toc' ? (
                <OutlineExtension />
              ) : (
                <AIExtension />
              )}
            </Suspense>
          </DeferredMount>
        </DockPanelBody>
      ) : null}
    </Container>
  )
}
