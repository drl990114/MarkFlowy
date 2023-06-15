import { AppInfoDialog, SideBar } from '@/components'
import EditorArea from '@/components/EditorArea'
import { APP_NAME } from '@/constants'
import { useEditorStore } from '@/stores'
import { appWindow } from '@tauri-apps/api/window'
import { useEffect } from 'react'
import { Container } from './styles'

function Root() {
  const { activeId } = useEditorStore()

  useEffect(() => {
    if (!activeId) {
      appWindow.setTitle(APP_NAME)
    }
  }, [activeId])

  return (
    <Container>
      <SideBar />
      <EditorArea />
      <AppInfoDialog />
    </Container>
  )
}

export default Root
