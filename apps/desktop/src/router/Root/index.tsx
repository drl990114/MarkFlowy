import { useEffect } from 'react'
import { Container } from './styles'
import { AppInfoDialog, SideBar } from '@/components'
import EditorArea from '@/components/EditorArea'
import { APP_NAME } from '@/constants'
import { useEditorStore } from '@/stores'
import TitleBar, { setTitleBarText } from '@/components/TitleBar'
import TableDialog from '@/editorToolBar/TableDialog'
import { useCommandInit } from '@/hooks/useCommandInit'

function Root() {
  const { activeId } = useEditorStore()

  useCommandInit()

  useEffect(() => {
    if (!activeId) setTitleBarText(APP_NAME)
  }, [activeId])

  return (
    <>
      <TitleBar />
      <Container>
        <SideBar />
        <EditorArea />
        <AppInfoDialog />
        <TableDialog />
      </Container>
    </>
  )
}

export default Root
