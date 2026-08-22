import { commandRegistry } from '@/commands'
import { SideBar } from '@/components'
import { scheduleActiveEditorFocus } from '@/components/EditorArea/focusActiveEditor'
import EditorArea from '@/components/EditorArea'
import { scheduleDockFocus } from '@/components/SideBar/DockSwitcher'
import RightBar from '@/components/SideBar/RightBar'
import StatusBar from '@/components/StatusBar'
import { BookMarkDialog } from '@/extensions/bookmarks/BookMarkDialog'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import { useDockViewportMode } from '@/hooks/useDockViewportMode'
import { useTranslation } from '@/i18n'
import { useEditorStore } from '@/stores'
import useLayoutStore, {
  MAX_LEFT_DOCK_SIZE,
  MAX_RIGHT_DOCK_SIZE,
  MIN_LEFT_DOCK_SIZE,
  MIN_RIGHT_DOCK_SIZE,
} from '@/stores/useLayoutStore'
import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { Group, Panel, useDefaultLayout } from 'react-resizable-panels'
import { toast } from 'zens'
import { DockOverlayContainer, RootPageLayout, StyleSeparator } from './styles'
import { ZenModeHint } from './ZenModeHint'
import { hasOpenInteractiveLayer } from './dockOverlayDismissal'
import {
  queueDoubleEscapeResolution,
  registerZenModeCommand,
  requestZenModeToggle,
} from './zenMode'

export const RESIZE_PANEL_STORAGE_KEY = 'root-resize-panel'
const LEFT_DOCK_LABEL_KEYS = {
  explorer: 'sidebar.explorer',
  search: 'sidebar.search',
  bookmarks: 'sidebar.bookmarks',
} as const
const RIGHT_DOCK_LABEL_KEYS = {
  toc: 'sidebar.table_of_contents',
  ai: 'ai.assistant',
} as const

function Root() {
  const { t } = useTranslation()
  const viewportMode = useDockViewportMode()
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: RESIZE_PANEL_STORAGE_KEY,
    storage: localStorage,
  })

  const setLeftBarVisible = useLayoutStore((state) => state.setLeftBarVisible)
  const setRightBarVisible = useLayoutStore((state) => state.setRightBarVisible)
  const syncDockPanelFromResize = useLayoutStore((state) => state.syncDockPanelFromResize)
  const setOverlayDock = useLayoutStore((state) => state.setOverlayDock)
  const setViewportMode = useLayoutStore((state) => state.setViewportMode)
  const leftActivePanelId = useLayoutStore((state) => state.leftBar.activePanelId)
  const rightActivePanelId = useLayoutStore((state) => state.rightBar.activePanelId)
  const leftBarVisible = useLayoutStore((state) => state.leftBar.visible)
  const rightBarVisible = useLayoutStore((state) => state.rightBar.visible)
  const overlayDock = useLayoutStore((state) => state.overlayDock)
  const zenModeActive = useLayoutStore((state) => state.zenModeActive)
  const leftPanelRef = useRef<PanelImperativeHandle>(null)
  const rightPanelRef = useRef<PanelImperativeHandle>(null)
  const initialDockSizesRef = useRef({
    left: useLayoutStore.getState().leftBar.size,
    right: useLayoutStore.getState().rightBar.size,
  })
  const initializedPanelStateRef = useRef(false)
  const lastEscapeAtRef = useRef<number | null>(null)
  const pointerStartedWithInteractiveLayerRef = useRef(false)
  const leftDockLabel = t(LEFT_DOCK_LABEL_KEYS[leftActivePanelId])
  const rightDockLabel = t(RIGHT_DOCK_LABEL_KEYS[rightActivePanelId])

  const toggleLeftPanelVisible = useCallback(() => {
    const state = useLayoutStore.getState()
    if (state.zenModeActive) return

    const usesOverlay = state.viewportMode === 'compact'
    const wasVisible = usesOverlay ? state.overlayDock === 'left' : state.leftBar.visible
    state.toggleDockPanel('left', state.leftBar.activePanelId)
    if (wasVisible) scheduleActiveEditorFocus()
    else scheduleDockFocus('left')
  }, [])

  const toggleRightPanelVisible = useCallback(() => {
    const state = useLayoutStore.getState()
    if (state.zenModeActive) return

    const usesOverlay = state.viewportMode !== 'wide'
    const wasVisible = usesOverlay ? state.overlayDock === 'right' : state.rightBar.visible
    state.toggleDockPanel('right', state.rightBar.activePanelId)
    if (wasVisible) scheduleActiveEditorFocus()
    else scheduleDockFocus('right')
  }, [])

  const toggleZenMode = useCallback(() => {
    const layoutState = useLayoutStore.getState()
    const hasActiveDocument = Boolean(useEditorStore.getState().activeId)

    requestZenModeToggle({
      active: layoutState.zenModeActive,
      hasActiveDocument,
      onToggled: (active) => {
        layoutState.setZenModeActive(active)
        scheduleActiveEditorFocus()
      },
      onUnavailable: () => toast.info(t('zenMode.openFileFirst')),
    })
  }, [t])

  const handleRootLayoutChanged = useCallback(
    (layout: Parameters<typeof onLayoutChanged>[0]) => {
      const state = useLayoutStore.getState()
      if (state.zenModeActive || state.viewportMode !== 'wide') return
      onLayoutChanged(layout)
    },
    [onLayoutChanged],
  )

  const { getBookMarkList } = useBookMarksStore()

  useLayoutEffect(() => {
    setViewportMode(viewportMode)

    const leftPanel = leftPanelRef.current
    const rightPanel = rightPanelRef.current
    if (!leftPanel || !rightPanel || zenModeActive) return

    if (!initializedPanelStateRef.current) {
      setLeftBarVisible(!leftPanel.isCollapsed())
      setRightBarVisible(!rightPanel.isCollapsed())
      initializedPanelStateRef.current = true
    }

    const layoutState = useLayoutStore.getState()
    const leftDocked = viewportMode !== 'compact'
    const rightDocked = viewportMode === 'wide'

    if (leftDocked && layoutState.leftBar.visible) leftPanel.expand()
    else leftPanel.collapse()

    if (rightDocked && layoutState.rightBar.visible) rightPanel.expand()
    else rightPanel.collapse()
  }, [
    leftBarVisible,
    rightBarVisible,
    setLeftBarVisible,
    setRightBarVisible,
    setViewportMode,
    viewportMode,
    zenModeActive,
  ])

  useEffect(() => {
    const d1 = commandRegistry.registerCommand({
      id: 'app_toggleLeftsidebarVisible',
      handler: toggleLeftPanelVisible,
    })
    const d2 = commandRegistry.registerCommand({
      id: 'app_toggleRightsidebarVisible',
      handler: toggleRightPanelVisible,
    })

    return () => {
      d1.dispose()
      d2.dispose()
    }
  }, [toggleLeftPanelVisible, toggleRightPanelVisible])

  useEffect(() => {
    if (!overlayDock || zenModeActive) return

    const handlePointerDownCapture = () => {
      pointerStartedWithInteractiveLayerRef.current = hasOpenInteractiveLayer()
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (pointerStartedWithInteractiveLayerRef.current) {
        pointerStartedWithInteractiveLayerRef.current = false
        return
      }

      const target = event.target
      if (!(target instanceof Element)) return
      if (
        target.closest(`[data-mf-dock-overlay="${overlayDock}"]`) ||
        target.closest('[data-mf-dock-trigger]') ||
        target.closest('[data-mf-portal]')
      ) {
        return
      }

      setOverlayDock(null)
      scheduleActiveEditorFocus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat
      ) {
        return
      }

      setOverlayDock(null)
      scheduleActiveEditorFocus()
    }

    window.addEventListener('pointerdown', handlePointerDownCapture, true)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownCapture, true)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [overlayDock, setOverlayDock, zenModeActive])

  useEffect(() => {
    const disposable = registerZenModeCommand(commandRegistry, {
      label: t('command.id_descriptions.app_toggleZenMode'),
      handler: toggleZenMode,
    })

    return () => disposable.dispose()
  }, [t, toggleZenMode])

  useEffect(() => {
    if (!zenModeActive) {
      lastEscapeAtRef.current = null
      return
    }

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      queueDoubleEscapeResolution({
        event,
        getLastEscapeAt: () => lastEscapeAtRef.current,
        isActive: () => useLayoutStore.getState().zenModeActive,
        now: performance.now(),
        onExit: () => {
          useLayoutStore.getState().setZenModeActive(false)
          scheduleActiveEditorFocus()
        },
        setLastEscapeAt: (lastEscapeAt) => {
          lastEscapeAtRef.current = lastEscapeAt
        },
      })
    }

    window.addEventListener('keydown', handleKeyDownCapture, true)
    return () => window.removeEventListener('keydown', handleKeyDownCapture, true)
  }, [zenModeActive])

  useEffect(() => {
    getBookMarkList()
  }, [getBookMarkList])

  // Listen for live-preview fullscreen events from editor package
  // to adjust sidebar/statusbar z-index so fullscreen content is not obscured
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ fullscreen: boolean }>).detail
      const active = detail.fullscreen

      document.body.classList.toggle('mf-livepreview-fullscreen-active', active)

      // Directly hide/show sidebars and status bar via DOM manipulation
      // (more reliable than CSS-only approach)
      const leftPanel = document.getElementById('root-left')
      const rightPanel = document.getElementById('root-right')
      const statusBar = document.querySelector('.app-status-bar')
      const dockOverlays = document.querySelectorAll('[data-mf-dock-overlay]')

      ;[leftPanel, rightPanel, statusBar, ...dockOverlays].forEach((el) => {
        if (!el) return
        if (active) {
          el.setAttribute('data-mf-hidden', '')
        } else {
          el.removeAttribute('data-mf-hidden')
        }
      })
    }
    document.addEventListener('mf:livepreview-fullscreen', handler)
    return () => document.removeEventListener('mf:livepreview-fullscreen', handler)
  }, [])

  return (
    <RootPageLayout data-mf-zen-mode={zenModeActive ? '' : undefined}>
      <Group
        defaultLayout={defaultLayout}
        disabled={zenModeActive}
        onLayoutChanged={handleRootLayoutChanged}
        resizeTargetMinimumSize={{ coarse: 20, fine: 7 }}
      >
        <Panel
          aria-label={leftDockLabel}
          data-mf-dock-side='left'
          data-mf-dock-visible={viewportMode !== 'compact' && leftBarVisible ? 'true' : 'false'}
          id='root-left'
          collapsible
          collapsedSize={0}
          defaultSize={`${initialDockSizesRef.current.left}px`}
          groupResizeBehavior='preserve-pixel-size'
          maxSize={`${MAX_LEFT_DOCK_SIZE}px`}
          minSize={`${MIN_LEFT_DOCK_SIZE}px`}
          onResize={(size) => {
            syncDockPanelFromResize('left', size.inPixels)
          }}
          panelRef={leftPanelRef}
          role='complementary'
          tabIndex={-1}
        >
          {viewportMode !== 'compact' ? <SideBar /> : null}
        </Panel>
        <StyleSeparator
          aria-hidden={viewportMode === 'compact'}
          data-mf-hidden={viewportMode === 'compact' ? '' : undefined}
          data-mf-root-separator=''
          disabled={viewportMode === 'compact' || zenModeActive}
        />
        <Panel
          id='root-center'
          groupResizeBehavior='preserve-relative-size'
          minSize='320px'
          role='main'
        >
          <EditorArea />
        </Panel>
        <StyleSeparator
          aria-hidden={viewportMode !== 'wide'}
          data-mf-hidden={viewportMode !== 'wide' ? '' : undefined}
          data-mf-root-separator=''
          disabled={viewportMode !== 'wide' || zenModeActive}
        />
        <Panel
          aria-label={rightDockLabel}
          data-mf-dock-side='right'
          data-mf-dock-visible={viewportMode === 'wide' && rightBarVisible ? 'true' : 'false'}
          id='root-right'
          collapsible
          collapsedSize={0}
          defaultSize={`${initialDockSizesRef.current.right}px`}
          groupResizeBehavior='preserve-pixel-size'
          maxSize={`${MAX_RIGHT_DOCK_SIZE}px`}
          minSize={`${MIN_RIGHT_DOCK_SIZE}px`}
          onResize={(size) => {
            syncDockPanelFromResize('right', size.inPixels)
          }}
          panelRef={rightPanelRef}
          role='complementary'
          tabIndex={-1}
        >
          {viewportMode === 'wide' ? <RightBar /> : null}
        </Panel>
      </Group>
      {viewportMode === 'compact' ? (
        <DockOverlayContainer
          $side='left'
          $visible={overlayDock === 'left'}
          aria-label={leftDockLabel}
          aria-hidden={overlayDock !== 'left'}
          data-mf-dock-overlay='left'
          data-mf-dock-side='left'
          data-mf-dock-visible={overlayDock === 'left' ? 'true' : 'false'}
          inert={overlayDock !== 'left'}
          role='complementary'
          tabIndex={-1}
        >
          <SideBar />
        </DockOverlayContainer>
      ) : null}
      {viewportMode !== 'wide' ? (
        <DockOverlayContainer
          $side='right'
          $visible={overlayDock === 'right'}
          aria-label={rightDockLabel}
          aria-hidden={overlayDock !== 'right'}
          data-mf-dock-overlay='right'
          data-mf-dock-side='right'
          data-mf-dock-visible={overlayDock === 'right' ? 'true' : 'false'}
          inert={overlayDock !== 'right'}
          role='complementary'
          tabIndex={-1}
        >
          <RightBar />
        </DockOverlayContainer>
      ) : null}
      <div className='app-status-bar'>
        <StatusBar />
      </div>
      <ZenModeHint active={zenModeActive} />
      <BookMarkDialog />
    </RootPageLayout>
  )
}

export default memo(Root)
