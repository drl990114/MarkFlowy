import { checkUpdate, installUpdate } from '@tauri-apps/api/updater'
import { useCallback, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Root, Setting } from '@router'
import { listen } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/window'
import { APP_NAME, EVENT } from '@constants'


function App() {
  useEffect(() => {
    eventInit()
    // updaterinit()
  }, [])

  const eventInit = useCallback(() => {
    listen(EVENT.open_window_setting, () => {
      new WebviewWindow(`setting`, {
        url: './setting',
        title: `${APP_NAME} Setting`,
        width: 1000,
        height: 600,
        minWidth: 500,
        minHeight: 500,
        focus: true,
      })
    })
  }, [])

  const updaterinit = useCallback(async () => {
    // TODO 更新默认的 setting
    const update = await checkUpdate()
    if (update.shouldUpdate) await installUpdate()
  }, [])

  return (
    <Routes>
      <Route index path="/" element={<Root />} />
      <Route path="/setting" element={<Setting />} />
    </Routes>
  )
}

export default App
