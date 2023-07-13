import { useEffect } from 'react'
import { Container } from './styles'
import { AppInfoDialog, SideBar } from '@/components'
import EditorArea from '@/components/EditorArea'
import { APP_NAME } from '@/constants'
import { useEditorStore } from '@/stores'
import { setTitleBarText } from '@/components/TitleBar'

function Root() {
  const { activeId } = useEditorStore()

  useEffect(() => {
    if (!activeId)
    setTitleBarText(APP_NAME)

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
