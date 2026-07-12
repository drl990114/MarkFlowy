import { commandRegistry } from '@/commands'
import { AppInfoDialog, SideBar } from '@/components'
import EditorArea from '@/components/EditorArea'
import { PageLayout } from '@/components/Layout'
import RightBar from '@/components/SideBar/RightBar'
import StatusBar from '@/components/StatusBar'
import { WorkspaceDialog } from '@/components/WorkspaceDialog'
import { BookMarkDialog } from '@/extensions/bookmarks/BookMarkDialog'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import { useCommandInit } from '@/hooks/useCommandInit'
import { appInfoStoreSetup } from '@/services/app-info'
import useLayoutStore from '@/stores/useLayoutStore'
import { memo, useEffect, useRef } from 'react'
import { Group, Panel, PanelImperativeHandle, useDefaultLayout } from 'react-resizable-panels'
import { SettingDialog } from '../Setting/component/SettingDialog'
import { StyleSeparator } from './styles'

export const RESIZE_PANEL_STORAGE_KEY = 'root-resize-panel'

function Root() {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: RESIZE_PANEL_STORAGE_KEY,
    storage: localStorage,
  })

  const { setLeftBarVisible, setRightBarVisible } = useLayoutStore()
  const leftPanelRef = useRef<PanelImperativeHandle>(null)
  const rightPanelRef = useRef<PanelImperativeHandle>(null)

  const toggleLeftPanelVisible = () => {
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
  }

  const toggleRightPanelVisible = () => {
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
  }

  const { getBookMarkList } = useBookMarksStore()

  useCommandInit()

  useEffect(() => {
    appInfoStoreSetup()
    const d1 = commandRegistry.registerCommand({
      id: 'app_toggleLeftsidebarVisible',
      handler: toggleLeftPanelVisible,
    })
    const d2 = commandRegistry.registerCommand({
      id: 'app_toggleRightsidebarVisible',
      handler: toggleRightPanelVisible,
    })

    leftPanelRef.current?.isCollapsed() ? setLeftBarVisible(false) : setLeftBarVisible(true)
    rightPanelRef.current?.isCollapsed() ? setRightBarVisible(false) : setRightBarVisible(true)

    return () => {
      d1.dispose()
      d2.dispose()
    }
  }, [])

  useEffect(() => {
    getBookMarkList()
  }, [])

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
    <PageLayout>
      {/* <TitleBar /> */}
      <Group defaultLayout={defaultLayout} onLayoutChange={onLayoutChanged}>
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
        <StyleSeparator />
        <Panel id='root-center' defaultSize={60} minSize={40}>
          <EditorArea />
        </Panel>
        <StyleSeparator />
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

      {/* global dialogs */}
      <AppInfoDialog />
      <BookMarkDialog />
      <SettingDialog />
      <WorkspaceDialog />
    </PageLayout>
  )
}

export default memo(Root)
