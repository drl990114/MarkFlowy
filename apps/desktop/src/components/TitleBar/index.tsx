import { getCurrent } from '@tauri-apps/plugin-window'

import { useState } from 'react'
import { Container } from './styled'
import { Controls } from './Controls'
import { CenterMenu } from './CenterMenu'

const appWindow = getCurrent()

export default function TitleBar() {
  const [isScaleup, setScaleup] = useState(false)

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
    <Container data-tauri-drag-region onDoubleClick={handleTitleBarDoubleClick}>
      <CenterMenu />
      <div id='titlebar' className='titlebar-text' data-tauri-drag-region>
        {'MarkFlowy'}
      </div>
      <Controls />
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
