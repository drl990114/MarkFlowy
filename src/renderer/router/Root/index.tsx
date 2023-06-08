import { APP_NAME } from '@/constants'
import { AppInfoDialog, SideBar } from '@/renderer/components'
import EditorArea from '@/renderer/components/EditorArea'
import { useEditorStore } from '@/renderer/stores'
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
