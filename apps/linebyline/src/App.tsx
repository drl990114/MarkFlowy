import { BaseStyle } from '@linebyline/editor'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { invoke } from '@tauri-apps/api'
import { emit, listen } from '@tauri-apps/api/event'
import type { Theme } from '@tauri-apps/api/window'
import { useCallback, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import 'remixicon/fonts/remixicon.css'
import { ThemeProvider } from 'styled-components'
import { GlobalStyles } from './globalStyles'
import { useGlobalSettingData, useGlobalTheme } from './hooks'
import useGlobalOSInfo from './hooks/useOSInfo'
import { i18nInit } from './i18n'
import { Root, Setting } from '@/router'
import { loadTask, use } from '@/helper/schedule'
import { CacheManager } from '@/helper'
import { useEditorStore } from './stores'
import { createWelcomeFile, readDirectory } from './helper/filesys'
import { getFileObject, getFileObjectByPath } from './helper/files'

function App() {
  useGlobalOSInfo()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, handler] = useGlobalSettingData()
  const { themeColors, muiTheme, setTheme } = useGlobalTheme()
  const editorStore = useEditorStore()
  const { setFolderData, addOpenedFile, setActiveId } = editorStore
  const { setSetting } = handler
  const isWeb = (window as any).__TAURI_IPC__ === undefined

  // TODO web need return a editor
  if (!isWeb) {
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
          }),
      ),
    )
    use(
      loadTask('cache', async () => {
        function pushWelcomeFile () {
          const welcomeFile = createWelcomeFile()
          setActiveId(welcomeFile.id)
          addOpenedFile(welcomeFile.id)
        }
        try {
          const cacheData = await CacheManager.init()
          const history = cacheData[0].openFolderHistory
          if (history.length > 0) {
            readDirectory(history[0].path).then((res) => {
              setFolderData(res)
              const openedFilePaths: string[] = cacheData[0].openedFilePaths
              const activeFilePath = cacheData[0].activeFilePath

              if (activeFilePath) {
                const activeFile = getFileObjectByPath(activeFilePath)
                if (activeFile) {
                  setActiveId(activeFile.id)
                }
              }

              if (openedFilePaths) {
                openedFilePaths.forEach((path) => {
                  const cur = getFileObjectByPath(path)
                  if (cur) {
                    addOpenedFile(cur.id)
                  }
                })
              } else {
                pushWelcomeFile()
              }

              useEditorStore.subscribe((state) => {
                const openedFiles = state.opened.map((fileId) => {
                  const file = getFileObject(fileId)
                  return file.path
                })
                CacheManager.cacheData.openedFilePaths = openedFiles
                if (state.activeId) {
                  CacheManager.cacheData.activeFilePath = getFileObject(state.activeId)?.path
                }

                CacheManager.saveCache()
              })
            })
          } else {
            pushWelcomeFile()
          }

        } catch (error) {
          pushWelcomeFile()
        }
      }),
    )
  }

  const eventInit = useCallback(() => {
    const unListenMenu = listen<string>('native:menu', ({ payload }) => {
      // TODO Refactor: use a eventemitter in pure web runtime
      emit(payload)
    })

    const unListenChangeTheme = listen('change_theme', ({ payload }) => {
      setTheme(payload as Theme)
    })

    return () => {
      unListenChangeTheme.then((fn) => fn())
      unListenMenu.then((fn) => fn())
    }
  }, [setTheme])

  useEffect(() => {
    if (isWeb) return
    const unlisten = eventInit()
    // updaterinit()

    return () => {
      unlisten()
    }
  }, [eventInit, isWeb])

  // const updaterinit = useCallback(async () => {
  //   // TODO 更新默认的 setting
  //   const update = await checkUpdate()
  //   if (update.shouldUpdate)
  //     await installUpdate()
  // }, [])

  return (
    <ThemeProvider theme={themeColors}>
      <MuiThemeProvider theme={muiTheme}>
        <GlobalStyles />
        <BaseStyle />
        <Routes>
          <Route index path='/' element={<Root />} />
          <Route path='/setting' element={<Setting />} />
        </Routes>
      </MuiThemeProvider>
    </ThemeProvider>
  )
}

export default App
