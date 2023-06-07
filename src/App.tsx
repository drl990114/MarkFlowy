import { APP_NAME, EVENT } from '@constants'
import { Root, Setting } from '@router'
import { invoke } from '@tauri-apps/api'
import { listen } from '@tauri-apps/api/event'
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater'
import { Theme, WebviewWindow } from '@tauri-apps/api/window'
import { CacheManager } from '@utils'
import { useCallback, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import 'remixicon/fonts/remixicon.css'
import { ThemeProvider } from 'styled-components'
import { GlobalStyles } from './globalStyles'
import { useGlobalSettingData, useGlobalTheme } from './hooks'
import useGlobalOSInfo from './hooks/useOSInfo'
import { i18nInit } from './i18n'
import { loadTask, use } from './utils/schedule'

function App() {
  const [_, handler] = useGlobalSettingData()
  const { themeColors, setTheme } = useGlobalTheme()
  const { setSetting } = handler

  use(
    loadTask(
      'confInit',
      () =>
        new Promise((resolve) => {
          invoke<Record<string, any>>('get_app_conf').then((res) => {
            console.log('conf', res)
            setSetting(res)
            setTheme(res.theme)
            i18nInit({ lng: res.language })
            resolve(res)
          })
        })
    )
  )

  use(loadTask('cache', () => CacheManager.init()))

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
      })
    })

    const unListenChangeTheme = listen('change_theme', ({ payload }) => {
      console.log('theme', payload)
      setTheme(payload as Theme)
    })

    return () => {
      unListenOpenSetting.then((fn) => fn())
      unListenChangeTheme.then((fn) => fn())
    }
  }, [])

  const updaterinit = useCallback(async () => {
    // TODO 更新默认的 setting
    const update = await checkUpdate()
    if (update.shouldUpdate) await installUpdate()
  }, [])

  return (
    <ThemeProvider theme={themeColors}>
      <GlobalStyles />
      <Routes>
        <Route index path="/" element={<Root />} />
        <Route path="/setting" element={<Setting />} />
      </Routes>
    </ThemeProvider>
  )
}

export default App
