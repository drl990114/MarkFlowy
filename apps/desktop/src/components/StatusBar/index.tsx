import { Container } from './styled'
import { TaskList } from '../TitleBar/TaskList'
import { CenterMenu } from './SettingBtn'
import { LayoutBtn } from './LayoutBtn'

export default function StatusBar() {

  return (
    <Container>
      <CenterMenu />
      <LayoutBtn />
      <TaskList />
    </Container>
  )
}
