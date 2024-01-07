import { useEffect } from 'react'
import { Container } from './styles'
import { AppInfoDialog, SideBar } from '@/components'
import EditorArea from '@/components/EditorArea'
import { useEditorStore } from '@/stores'
import TitleBar, { setTitleBarText } from '@/components/TitleBar'
import TableDialog from '@/components/EditorArea/editorToolBar/TableDialog'
import { useCommandInit } from '@/hooks/useCommandInit'
import { BookMarkDialog } from '@/extensions/bookmarks/BookMarkDialog'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import { PageLayout } from '@/components/Layout'
import { SettingDialog } from '../Setting/component/SettingDialog'

function Root() {
  const { activeId } = useEditorStore()
  const { getBookMarkList } = useBookMarksStore()

  useCommandInit()

  useEffect(() => {
    getBookMarkList()
  }, [getBookMarkList])

  useEffect(() => {
    if (!activeId) setTitleBarText('')
  }, [activeId])

  return (
    <PageLayout>
      <TitleBar />
      <Container>
        <SideBar />
        <EditorArea />
        <AppInfoDialog />
        <TableDialog />
        <BookMarkDialog />
        <SettingDialog />
      </Container>
    </PageLayout>
  )
}

export default Root
