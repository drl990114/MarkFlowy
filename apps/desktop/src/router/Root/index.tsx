import { commandRegistry } from '@/commands'
import { SideBar } from '@/components'
import { scheduleActiveEditorFocus } from '@/components/EditorArea/focusActiveEditor'
import EditorArea from '@/components/EditorArea'
import { scheduleDockFocus } from '@/components/SideBar/DockSwitcher'
import RightBar from '@/components/SideBar/RightBar'
import StatusBar from '@/components/StatusBar'
import { BookMarkDialog } from '@/extensions/bookmarks/BookMarkDialog'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import { QuickOpenDialog } from '@/extensions/quick-open/QuickOpenDialog'
import { CommandPaletteDialog } from '@/extensions/command-palette/CommandPaletteDialog'
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
import { Group, Panel } from 'react-resizable-panels'
import { toast } from 'zens'
import { RootPageLayout, StyleSeparator } from './styles'
import { ZenModeHint } from './ZenModeHint'
import {
  queueDoubleEscapeResolution,
  registerZenModeCommand,
  requestZenModeToggle,
} from './zenMode'

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
  const syncDockPanelFromResize = useLayoutStore((state) => state.syncDockPanelFromResize)
  const leftActivePanelId = useLayoutStore((state) => state.leftBar.activePanelId)
  const rightActivePanelId = useLayoutStore((state) => state.rightBar.activePanelId)
  const leftDockVisible = useLayoutStore((state) => state.leftBar.visible)
  const rightDockVisible = useLayoutStore((state) => state.rightBar.visible)
  const zenModeActive = useLayoutStore((state) => state.zenModeActive)
  const leftPanelRef = useRef<PanelImperativeHandle>(null)
  const rightPanelRef = useRef<PanelImperativeHandle>(null)
  const initialDockSizesRef = useRef({
    left: useLayoutStore.getState().leftBar.visible ? useLayoutStore.getState().leftBar.size : 0,
    right: useLayoutStore.getState().rightBar.visible ? useLayoutStore.getState().rightBar.size : 0,
  })
  const lastEscapeAtRef = useRef<number | null>(null)
  const leftDockLabel = t(LEFT_DOCK_LABEL_KEYS[leftActivePanelId])
  const rightDockLabel = t(RIGHT_DOCK_LABEL_KEYS[rightActivePanelId])

  const toggleLeftPanelVisible = useCallback(() => {
    const state = useLayoutStore.getState()
    if (state.zenModeActive) return

    const wasVisible = state.leftBar.visible
    state.toggleDockPanel('left', state.leftBar.activePanelId)
    if (wasVisible) scheduleActiveEditorFocus()
    else scheduleDockFocus('left')
  }, [])

  const toggleRightPanelVisible = useCallback(() => {
    const state = useLayoutStore.getState()
    if (state.zenModeActive) return

    const wasVisible = state.rightBar.visible
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

  const { getBookMarkList } = useBookMarksStore()

  useLayoutEffect(() => {
    const leftPanel = leftPanelRef.current
    const rightPanel = rightPanelRef.current
    if (!leftPanel || !rightPanel || zenModeActive) return

    const layoutState = useLayoutStore.getState()
    if (leftDockVisible) {
      if (leftPanel.isCollapsed()) leftPanel.resize(`${layoutState.leftBar.size}px`)
    } else leftPanel.collapse()
    if (rightDockVisible) {
      if (rightPanel.isCollapsed()) rightPanel.resize(`${layoutState.rightBar.size}px`)
    } else rightPanel.collapse()
  }, [leftDockVisible, rightDockVisible, zenModeActive])

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
      ;[leftPanel, rightPanel, statusBar].forEach((el) => {
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
        disabled={zenModeActive}
        onLayoutChanged={(layout) => {
          // Finish a drag before disabling its handle so the library can release it cleanly.
          if (layout['root-left'] === 0) syncDockPanelFromResize('left', 0)
          if (layout['root-right'] === 0) syncDockPanelFromResize('right', 0)
        }}
        resizeTargetMinimumSize={{ coarse: 20, fine: 7 }}
      >
        <Panel
          aria-hidden={!leftDockVisible}
          aria-label={leftDockLabel}
          data-mf-dock-side='left'
          data-mf-dock-visible={leftDockVisible ? 'true' : 'false'}
          id='root-left'
          collapsible
          collapsedSize={0}
          defaultSize={`${initialDockSizesRef.current.left}px`}
          disabled={!leftDockVisible}
          groupResizeBehavior='preserve-pixel-size'
          inert={!leftDockVisible}
          maxSize={`${MAX_LEFT_DOCK_SIZE}px`}
          minSize={`${MIN_LEFT_DOCK_SIZE}px`}
          onResize={(size) => {
            if (size.inPixels > 0) syncDockPanelFromResize('left', size.inPixels)
          }}
          panelRef={leftPanelRef}
          role='complementary'
          tabIndex={-1}
        >
          <SideBar />
        </Panel>
        <StyleSeparator
          aria-hidden={!leftDockVisible || zenModeActive}
          aria-label={leftDockLabel}
          data-mf-hidden={!leftDockVisible || zenModeActive ? '' : undefined}
          data-mf-root-separator=''
          disabled={!leftDockVisible || zenModeActive}
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
          aria-hidden={!rightDockVisible || zenModeActive}
          aria-label={rightDockLabel}
          data-mf-hidden={!rightDockVisible || zenModeActive ? '' : undefined}
          data-mf-root-separator=''
          disabled={!rightDockVisible || zenModeActive}
        />
        <Panel
          aria-hidden={!rightDockVisible}
          aria-label={rightDockLabel}
          data-mf-dock-side='right'
          data-mf-dock-visible={rightDockVisible ? 'true' : 'false'}
          id='root-right'
          collapsible
          collapsedSize={0}
          defaultSize={`${initialDockSizesRef.current.right}px`}
          disabled={!rightDockVisible}
          groupResizeBehavior='preserve-pixel-size'
          inert={!rightDockVisible}
          maxSize={`${MAX_RIGHT_DOCK_SIZE}px`}
          minSize={`${MIN_RIGHT_DOCK_SIZE}px`}
          onResize={(size) => {
            if (size.inPixels > 0) syncDockPanelFromResize('right', size.inPixels)
          }}
          panelRef={rightPanelRef}
          role='complementary'
          tabIndex={-1}
        >
          <RightBar />
        </Panel>
      </Group>
      <div className='app-status-bar'>
        <StatusBar />
      </div>
      <ZenModeHint active={zenModeActive} />
      <BookMarkDialog />
      <QuickOpenDialog />
      <CommandPaletteDialog />
    </RootPageLayout>
  )
}

export default memo(Root)
