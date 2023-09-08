import { useEffect } from 'react'
import { Container } from './styles'
import { AppInfoDialog, SideBar } from '@/components'
import EditorArea from '@/components/EditorArea'
import { useEditorStore } from '@/stores'
import TitleBar, { setTitleBarText } from '@/components/TitleBar'
import TableDialog from '@/editorToolBar/TableDialog'
import { useCommandInit } from '@/hooks/useCommandInit'
import { BookMarkDialog } from '@/bookmarks/BookMarkDialog'
import useBookMarksStore from '@/bookmarks/useBookMarksStore'

function Root() {
  const { activeId } = useEditorStore()
  const { getBookMarkList }  = useBookMarksStore()

  useCommandInit()

  useEffect(() => {
    getBookMarkList()
  }, [getBookMarkList])

  useEffect(() => {
    if (!activeId) setTitleBarText('linebyline')
  }, [activeId])

  return (
    <>
      <TitleBar />
      <Container>
        <SideBar />
        <EditorArea />
        <AppInfoDialog />
        <TableDialog />
        <BookMarkDialog />
      </Container>
    </>
  )
}

export default Root
