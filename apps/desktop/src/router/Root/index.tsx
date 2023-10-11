import { useEffect } from 'react'
import { Container } from './styles'
import { AppInfoDialog, SideBar } from '@/components'
import EditorArea from '@/components/EditorArea'
import { useEditorStore } from '@/stores'
import TitleBar, { setTitleBarText } from '@/components/TitleBar'
import TableDialog from '@/components/EditorArea/editorToolBar/TableDialog'
import { useCommandInit } from '@/hooks/useCommandInit'
import { BookMarkDialog } from '@/bookmarks/BookMarkDialog'
import useBookMarksStore from '@/bookmarks/useBookMarksStore'
import { PageLayout } from '@/layout/PageLayout'

function Root() {
  const { activeId } = useEditorStore()
  const { getBookMarkList } = useBookMarksStore()

  useCommandInit()

  useEffect(() => {
    getBookMarkList()
  }, [getBookMarkList])

  useEffect(() => {
    if (!activeId) setTitleBarText('markflowy')
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
      </Container>
    </PageLayout>
  )
}

export default Root
