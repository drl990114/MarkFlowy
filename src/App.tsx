import { TitleBar } from '@/components'
import { APP_NAME, EVENT } from '@constants'
import { Root, Setting } from '@router'
import { listen } from '@tauri-apps/api/event'
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater'
import { WebviewWindow } from '@tauri-apps/api/window'
import { CacheManager } from '@utils'
import { useCallback, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import 'remixicon/fonts/remixicon.css'
import useGlobalOSInfo from './hooks/useOSInfo'
import { i18nInit } from './i18n'
import { loadTask, use } from './utils/schedule'

function App() {
  use(loadTask('i18n', i18nInit()))
  use(loadTask('cache', CacheManager.init()))

  useGlobalOSInfo()
  useEffect(() => {
    const unlisten = eventInit()
    // updaterinit()

    return () => {
      unlisten()
    }
  }, [])

  const eventInit = useCallback(() => {
    const unListenOpenSetting = listen(EVENT.open_window_setting, () => {
      new WebviewWindow(`setting`, {
        url: './setting',
        title: `${APP_NAME} Setting`,
        width: 1000,
        height: 600,
        minWidth: 500,
        minHeight: 500,
        focus: true,
        decorations: false,
      })
    })

    return () => {
      unListenOpenSetting.then((fn) => fn())
    }
  }, [])

  const updaterinit = useCallback(async () => {
    // TODO 更新默认的 setting
    const update = await checkUpdate()
    if (update.shouldUpdate) await installUpdate()
  }, [])

  return (
    <>
      <TitleBar />
      <Routes>
        <Route index path="/" element={<Root />} />
        <Route path="/setting" element={<Setting />} />
      </Routes>
    </>
  )
}

export default App
