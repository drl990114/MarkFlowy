import { Container } from './styled'
import { TaskList } from '../TitleBar/TaskList'
import { CenterMenu } from './SettingBtn'

export default function StatusBar() {

  return (
    <Container>
      <CenterMenu />
      <TaskList />
    </Container>
  )
}
