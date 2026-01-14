import { AppInfoDialog, SideBar } from '@/components'
import EditorArea from '@/components/EditorArea'
import { PageLayout } from '@/components/Layout'
import RightBar from '@/components/SideBar/RightBar'
import StatusBar from '@/components/StatusBar'
import { WorkspaceDialog } from '@/components/WorkspaceDialog'
import { useRefreshAIProvidersModels } from '@/extensions/ai/useAiChatStore'
import { BookMarkDialog } from '@/extensions/bookmarks/BookMarkDialog'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import { useCommandInit } from '@/hooks/useCommandInit'
import { appInfoStoreSetup } from '@/services/app-info'
import { useCommandStore } from '@/stores'
import useLayoutStore from '@/stores/useLayoutStore'
import { memo, useEffect, useRef } from 'react'
import { Group, Panel, PanelImperativeHandle, useDefaultLayout } from 'react-resizable-panels'
import { SettingDialog } from '../Setting/component/SettingDialog'
import { StyleSeparator } from './styles'

export const RESIZE_PANEL_STORAGE_KEY = 'root-resize-panel'

function Root() {
  useRefreshAIProvidersModels()

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
    useCommandStore.getState().addCommand({
      id: 'app_toggleLeftsidebarVisible',
      handler: toggleLeftPanelVisible,
    })
    useCommandStore.getState().addCommand({
      id: 'app_toggleRightsidebarVisible',
      handler: toggleRightPanelVisible,
    })

    leftPanelRef.current?.isCollapsed() ? setLeftBarVisible(false) : setLeftBarVisible(true)
    rightPanelRef.current?.isCollapsed() ? setRightBarVisible(false) : setRightBarVisible(true)
  }, [])

  useEffect(() => {
    getBookMarkList()
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
          minSize={10}
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
          minSize={10}
          panelRef={rightPanelRef}
        >
          <RightBar />
        </Panel>
      </Group>
      <StatusBar />

      {/* global dialogs */}
      <AppInfoDialog />
      <BookMarkDialog />
      <SettingDialog />
      <WorkspaceDialog />
    </PageLayout>
  )
}

export default memo(Root)
