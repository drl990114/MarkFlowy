import { AppInfoDialog, SideBar } from '@components'
import { Editor } from '../../editor'
import { Container } from './styles'

function Root() {
  return (
    <Container>
      <SideBar />
      <Editor />
      <AppInfoDialog />
    </Container>
  )
}

export default Root
