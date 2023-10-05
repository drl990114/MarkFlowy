import { getCurrent } from '@tauri-apps/plugin-window'

import { useState } from 'react'
import { TitleBarBg, Container } from './styled'

const appWindow = getCurrent()

export default function TitleBar(props: TitleBarProps) {
  const { transparent } = props
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
      {transparent ? null : <TitleBarBg data-tauri-drag-region />}
      <Container data-tauri-drag-region onDoubleClick={handleTitleBarDoubleClick}>
        {transparent ? null : (
          <div id='titlebar' className='titlebar-text' data-tauri-drag-region>
            {'MarkFlowy'}
          </div>
        )}
      </Container>
    </>
  )
}

interface TitleBarProps {
  transparent?: boolean
}

// TODO refactor: use file state
export const setTitleBarText = (text: string) => {
  appWindow.setTitle(text)

  const titleBarEl = document.getElementById('titlebar')
  if (titleBarEl) {
    titleBarEl.innerText = text
  }
}
