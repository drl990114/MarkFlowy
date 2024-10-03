import { getCurrentWindow } from '@tauri-apps/api/window'
import { useState } from 'react'
import { Container } from './styled'
import { Controls } from './Controls'
import { CenterMenu } from './CenterMenu'
import { useGlobalOSInfo } from '@/hooks'
import { TaskList } from './TaskList'

const appWindow = getCurrentWindow()

export default function TitleBar() {
  const [isScaleup, setScaleup] = useState(false)
  const { osType } = useGlobalOSInfo()

  const onScaleup = () => {
    appWindow.toggleMaximize()
    setScaleup(true)
  }

  const onScaledown = () => {
    appWindow.toggleMaximize()
    setScaleup(false)
  }

  const handleTitleBarDoubleClick = () => {
    if (isScaleup) {
      onScaledown()
    } else {
      onScaleup()
    }
  }

  return (
    <Container onDoubleClick={handleTitleBarDoubleClick}>
      <CenterMenu />
      <div id='titlebar' className='titlebar-text' data-tauri-drag-region />
      <TaskList />
      {osType === 'macos' ? null : <Controls />}
    </Container>
  )
}

// TODO refactor: use file state
export const setTitleBarText = (text: string) => {
  appWindow.setTitle(text)

  const titleBarEl = document.getElementById('titlebar')
  if (titleBarEl) {
    titleBarEl.innerText = text
  }
}
