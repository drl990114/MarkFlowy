import useGlobalOSInfo from '@/hooks/useOSInfo'
import { appWindow } from '@tauri-apps/api/window'
import { useState } from 'react'
import { MacOsContainer, OtherOsContainer } from './styles'

const TITLEBAR_TEXT_EL_ID = 'titlebar-text'

export default function TitleBar() {
  const [isScaleup, setScaleup] = useState(false)
  const { osType } = useGlobalOSInfo()

  const onMinimize = () => appWindow.minimize()

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

  const onClose = () => appWindow.close()

  if (typeof osType === 'undefined') {
    return <OtherOsContainer />
  }

  if (osType === 'Darwin') {
    return (
      <MacOsContainer id='titlebar' data-tauri-drag-region onDoubleClick={handleTitleBarDoubleClick}>
        <div className="titlebar-stoplight">
          <div className="titlebar-close" onClick={onClose}>
            <svg x="0px" y="0px" viewBox="0 0 6.4 6.4">
              <polygon fill="#4d0000" points="6.4,0.8 5.6,0 3.2,2.4 0.8,0 0,0.8 2.4,3.2 0,5.6 0.8,6.4 3.2,4 5.6,6.4 6.4,5.6 4,3.2"></polygon>
            </svg>
          </div>
          <div className="titlebar-minimize" onClick={onMinimize}>
            <svg x="0px" y="0px" viewBox="0 0 8 1.1">
              <rect fill="#995700" width="8" height="1.1"></rect>
            </svg>
          </div>
          <div className="titlebar-fullscreen" onClick={onScaleup}>
            <svg className="fullscreen-svg" x="0px" y="0px" viewBox="0 0 6 5.9">
              <path fill="#006400" d="M5.4,0h-4L6,4.5V0.6C5.7,0.6,5.3,0.3,5.4,0z"></path>
              <path fill="#006400" d="M0.6,5.9h4L0,1.4l0,3.9C0.3,5.3,0.6,5.6,0.6,5.9z"></path>
            </svg>
            <svg className="maximize-svg" x="0px" y="0px" viewBox="0 0 7.9 7.9">
              <polygon fill="#006400" points="7.9,4.5 7.9,3.4 4.5,3.4 4.5,0 3.4,0 3.4,3.4 0,3.4 0,4.5 3.4,4.5 3.4,7.9 4.5,7.9 4.5,4.5"></polygon>
            </svg>
          </div>
        </div>
        <div className="titlebar-text" data-tauri-drag-region>{'linebyline'}</div>
      </MacOsContainer>
    )
  }

  return (
    <OtherOsContainer data-tauri-drag-region onDoubleClick={handleTitleBarDoubleClick}>
      <div id={TITLEBAR_TEXT_EL_ID} className="p-1">
        LineByLine
      </div>
      <div>
        <div className="titlebar-button" id="titlebar-minimize">
          <i className="titlebar-icon ri-subtract-line" onClick={onMinimize}></i>
        </div>
        <div className="titlebar-button" id="titlebar-maximize">
          {isScaleup ? <i className="titlebar-icon ri-file-copy-line" onClick={onScaledown}></i> : <i onClick={onScaleup} className="titlebar-icon ri-stop-line"></i>}
        </div>
        <div className="titlebar-button" id="titlebar-close">
          <i className="titlebar-icon ri-close-fill" onClick={onClose}></i>
        </div>
      </div>
    </OtherOsContainer>
  )
}
