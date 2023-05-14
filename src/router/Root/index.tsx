import { AppInfoDialog, SideBar } from '@components'
import { Editor } from '../../editor'
import { Container } from './styles'
import { useEditorStore } from '@stores'
import EditorArea from '@/components/EditorArea'

function Root() {

  return (
    <Container>
      <SideBar />
       <EditorArea />
      <AppInfoDialog />
    </Container>
  )
}

export default Root
