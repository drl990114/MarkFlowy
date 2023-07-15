import { appWindow } from '@tauri-apps/api/window'
import { useState } from 'react'
import { TitleBarBg, Container } from './styled'

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
    <>
      <TitleBarBg data-tauri-drag-region />
      <Container data-tauri-drag-region onDoubleClick={handleTitleBarDoubleClick}>
        <div id="titlebar" className="titlebar-text" data-tauri-drag-region>
          {'LineByLine'}
        </div>
      </Container>
    </>
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
