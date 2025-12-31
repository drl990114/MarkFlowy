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
import { ImperativePanelHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { SettingDialog } from '../Setting/component/SettingDialog'
import { LeftPanel, RightPanel } from './styles'

export const RESIZE_PANEL_STORAGE_KEY = 'resize-panel'

function Root() {
  useRefreshAIProvidersModels()

  const { setLeftBarVisible, setRightBarVisible } = useLayoutStore()
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)

  const toggleLeftPanelVisible = () => {
    const panel = leftPanelRef.current
    if (panel) {
      if (panel.isExpanded()) {
        panel.collapse()
        setLeftBarVisible(false)
      } else {
        panel.expand()
        setLeftBarVisible(true)
      }
    }
  }

  const toggleRightPanelVisible = () => {
    const panel = rightPanelRef.current
    if (panel) {
      if (panel.isExpanded()) {
        panel.collapse()
        setRightBarVisible(false)
      } else {
        panel.expand()
        setRightBarVisible(true)
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

    leftPanelRef.current?.isExpanded() ? setLeftBarVisible(true) : setLeftBarVisible(false)
    rightPanelRef.current?.isExpanded() ? setRightBarVisible(true) : setRightBarVisible(false)
  }, [])

  useEffect(() => {
    getBookMarkList()
  }, [])

  return (
    <PageLayout>
      {/* <TitleBar /> */}
      <PanelGroup
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
        autoSaveId={RESIZE_PANEL_STORAGE_KEY}
        direction='horizontal'
      >
        <LeftPanel
          collapsible={true}
          collapsedSize={0}
          defaultSize={20}
          minSize={10}
          ref={leftPanelRef}
        >
          <SideBar />
        </LeftPanel>
        <PanelResizeHandle />
        <Panel defaultSize={60} minSize={40}>
          <EditorArea />
        </Panel>
        <PanelResizeHandle />
        <RightPanel
          collapsible={true}
          collapsedSize={0}
          defaultSize={20}
          minSize={10}
          ref={rightPanelRef}
        >
          <RightBar />
        </RightPanel>
      </PanelGroup>
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
