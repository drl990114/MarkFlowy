import { TaskList } from '../TitleBar/TaskList'
import { LayoutLeftBtn, LayoutRightBtn } from './LayoutBtn'
import { CenterMenu } from './SettingBtn'
import { Container } from './styled'

export default function StatusBar() {

  return (
    <Container>
      <TaskList />
      <LayoutLeftBtn />
      <LayoutRightBtn />
      <CenterMenu />
    </Container>
  )
}
