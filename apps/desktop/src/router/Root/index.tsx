import { commandRegistry } from '@/commands'
import { AppInfoDialog, SideBar } from '@/components'
import { scheduleActiveEditorFocus } from '@/components/EditorArea/focusActiveEditor'
import EditorArea from '@/components/EditorArea'
import RightBar from '@/components/SideBar/RightBar'
import StatusBar from '@/components/StatusBar'
import { WorkspaceDialog } from '@/components/WorkspaceDialog'
import { BookMarkDialog } from '@/extensions/bookmarks/BookMarkDialog'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import { useTranslation } from '@/i18n'
import { useEditorStore } from '@/stores'
import useLayoutStore from '@/stores/useLayoutStore'
import { memo, useCallback, useEffect, useRef } from 'react'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { Group, Panel, useDefaultLayout } from 'react-resizable-panels'
import { toast } from 'zens'
import { RootPageLayout, StyleSeparator } from './styles'
import { ZenModeHint } from './ZenModeHint'
import {
  queueDoubleEscapeResolution,
  registerZenModeCommand,
  requestZenModeToggle,
} from './zenMode'

export const RESIZE_PANEL_STORAGE_KEY = 'root-resize-panel'

function Root() {
  const { t } = useTranslation()
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: RESIZE_PANEL_STORAGE_KEY,
    storage: localStorage,
  })

  const setLeftBarVisible = useLayoutStore((state) => state.setLeftBarVisible)
  const setRightBarVisible = useLayoutStore((state) => state.setRightBarVisible)
  const zenModeActive = useLayoutStore((state) => state.zenModeActive)
  const leftPanelRef = useRef<PanelImperativeHandle>(null)
  const rightPanelRef = useRef<PanelImperativeHandle>(null)
  const lastEscapeAtRef = useRef<number | null>(null)

  const toggleLeftPanelVisible = useCallback(() => {
    if (useLayoutStore.getState().zenModeActive) return

    const panel = leftPanelRef.current
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand()
        setLeftBarVisible(true)
      } else {
        panel.collapse()
        setLeftBarVisible(false)
      }
    }
  }, [setLeftBarVisible])

  const toggleRightPanelVisible = useCallback(() => {
    if (useLayoutStore.getState().zenModeActive) return

    const panel = rightPanelRef.current
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand()
        setRightBarVisible(true)
      } else {
        panel.collapse()
        setRightBarVisible(false)
      }
    }
  }, [setRightBarVisible])

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
      if (useLayoutStore.getState().zenModeActive) return
      onLayoutChanged(layout)
    },
    [onLayoutChanged],
  )

  const { getBookMarkList } = useBookMarksStore()

  useEffect(() => {
    const d1 = commandRegistry.registerCommand({
      id: 'app_toggleLeftsidebarVisible',
      handler: toggleLeftPanelVisible,
    })
    const d2 = commandRegistry.registerCommand({
      id: 'app_toggleRightsidebarVisible',
      handler: toggleRightPanelVisible,
    })

    if (leftPanelRef.current?.isCollapsed()) setLeftBarVisible(false)
    else setLeftBarVisible(true)

    if (rightPanelRef.current?.isCollapsed()) setRightBarVisible(false)
    else setRightBarVisible(true)

    return () => {
      d1.dispose()
      d2.dispose()
    }
  }, [setLeftBarVisible, setRightBarVisible, toggleLeftPanelVisible, toggleRightPanelVisible])

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
      {/* <TitleBar /> */}
      <Group
        defaultLayout={defaultLayout}
        disabled={zenModeActive}
        onLayoutChange={handleRootLayoutChanged}
      >
        <Panel
          id='root-left'
          collapsible
          collapsedSize={0}
          defaultSize={20}
          minSize={160}
          panelRef={leftPanelRef}
        >
          <SideBar />
        </Panel>
        <StyleSeparator data-mf-root-separator='' />
        <Panel id='root-center' defaultSize={60} minSize={40}>
          <EditorArea />
        </Panel>
        <StyleSeparator data-mf-root-separator='' />
        <Panel
          id='root-right'
          collapsible
          collapsedSize={0}
          defaultSize={20}
          minSize={160}
          panelRef={rightPanelRef}
        >
          <RightBar />
        </Panel>
      </Group>
      <div className='app-status-bar'>
        <StatusBar />
      </div>
      <ZenModeHint active={zenModeActive} />
      <AppInfoDialog />
      <BookMarkDialog />
      <WorkspaceDialog />
    </RootPageLayout>
  )
}

export default memo(Root)
