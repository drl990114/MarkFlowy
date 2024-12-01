import { useEffect, useRef } from 'react'
import { AppInfoDialog, SideBar } from '@/components'
import EditorArea from '@/components/EditorArea'
import TableDialog from '@/components/EditorArea/editorToolBar/TableDialog'
import { useCommandInit } from '@/hooks/useCommandInit'
import { BookMarkDialog } from '@/extensions/bookmarks/BookMarkDialog'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import { PageLayout } from '@/components/Layout'
import { SettingDialog } from '../Setting/component/SettingDialog'
import { appInfoStoreSetup } from '@/services/app-info'
import StatusBar from '@/components/StatusBar'
import { useTitleBarEffect } from '@/hooks/useTitleBarEffect'
import { PanelGroup, Panel, PanelResizeHandle, ImperativePanelHandle } from 'react-resizable-panels'
import { TableOfContent } from '@/extensions/table-of-content'
import { useCommandStore } from '@/stores'
import useLayoutStore from '@/stores/useLayoutStore'

export const RESIZE_PANEL_STORAGE_KEY = 'resize-panel'

function Root() {
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
  useTitleBarEffect()

  useEffect(() => {
    appInfoStoreSetup()
    useCommandStore.getState().addCommand({
      id: 'app:toggle_leftsidebar_visible',
      handler: toggleLeftPanelVisible,
    })
    useCommandStore.getState().addCommand({
      id: 'app:toggle_rightsidebar_visible',
      handler: toggleRightPanelVisible,
    })

    leftPanelRef.current?.isExpanded() ? setLeftBarVisible(true) : setLeftBarVisible(false)
    rightPanelRef.current?.isExpanded() ? setRightBarVisible(true) : setRightBarVisible(false)
  }, [])

  useEffect(() => {
    getBookMarkList()
  }, [getBookMarkList])

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
        <Panel
          collapsible={true}
          collapsedSize={0}
          defaultSize={20}
          minSize={10}
          ref={leftPanelRef}
        >
          <SideBar />
        </Panel>
        <PanelResizeHandle />
        <Panel defaultSize={60} minSize={40}>
          <EditorArea />
        </Panel>
        <PanelResizeHandle />
        <Panel
          collapsible={true}
          collapsedSize={0}
          defaultSize={20}
          minSize={10}
          ref={rightPanelRef}
        >
          {TableOfContent.components}
        </Panel>
      </PanelGroup>
      <StatusBar />

      {/* global dialogs */}
      <AppInfoDialog />
      <TableDialog />
      <BookMarkDialog />
      <SettingDialog />
    </PageLayout>
  )
}

export default Root
