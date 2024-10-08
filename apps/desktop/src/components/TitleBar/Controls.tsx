import styled from 'styled-components'
import { memo, useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export const Controls = memo(() => {
  const [isScaleup, setScaleup] = useState(false)
  const appWindow = getCurrentWindow()

  useEffect(() => {
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then((isMax) => {
        setScaleup(isMax)
      })
    })

    return () => {
      unlisten.then((f) => f())
    }
  }, [appWindow])

  const onMinimize = () => appWindow.minimize()

  const onScaleup = () => {
    // appWindow.toggleMaximize()
    appWindow.setFullscreen(true)
    setScaleup(true)
  }

  const onScaledown = () => {
    // appWindow.toggleMaximize()
    appWindow.setFullscreen(false)
    setScaleup(false)
  }

  const onClose = () => appWindow.close()

  return (
    <Container>
      <i className='titlebar-icon ri-subtract-line' onClick={onMinimize}></i>

      {isScaleup ? (
        <i className='titlebar-icon ri-file-copy-line' onClick={onScaledown}></i>
      ) : (
        <i onClick={onScaleup} className='titlebar-icon ri-stop-line'></i>
      )}

      <i id='ttb-close' className='titlebar-icon ri-close-fill' onClick={onClose}></i>
    </Container>
  )
})

const Container = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;

  .titlebar-icon {
    width: ${(props) => props.theme.titleBarControlBtnWidth};
    height: ${(props) => props.theme.titleBarHeight};
    font-size: ${props => props.theme.fontBase};
    text-align: center;
    line-height: ${(props) => props.theme.titleBarHeight};
    cursor: pointer;
  }

  .titlebar-icon:hover {
    background-color: ${(props) => props.theme.titleBarDefaultHoverColor};
  }

  #ttb-close:hover {
    background-color: #dc2626;
  }
`
