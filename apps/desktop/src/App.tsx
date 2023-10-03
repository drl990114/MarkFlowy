import { BaseStyle } from '@markflowy/theme'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { invoke } from '@tauri-apps/api'
import { listen } from '@tauri-apps/api/event'
import type { Theme } from '@tauri-apps/api/window'
import { useCallback, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ThemeProvider, StyleSheetManager } from 'styled-components'
import { GlobalStyles } from './globalStyles'
import { useGlobalSettingData, useGlobalTheme, useGlobalKeyboard, useGlobalOSInfo } from './hooks'
import { i18nInit } from './i18n'
import { Root, Setting } from '@/router'
import { loadTask, use } from '@/helper/schedule'
import { useEditorStore } from './stores'
import { createWelcomeFile, readDirectory } from './helper/filesys'
import { getFileObject, getFileObjectByPath } from './helper/files'
import type { WorkspaceInfo } from '@/stores/useOpenedCacheStore'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import { cacheStore } from './helper/cacheStore'
import 'remixicon/fonts/remixicon.css'
import bus from './helper/eventBus'
import isPropValid from '@emotion/is-prop-valid'
import type { FC } from 'react'

const App: FC = function () {
  useGlobalOSInfo()
  useGlobalKeyboard()
  const { setRecentWorkspaces } = useOpenedCacheStore()
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
        function pushWelcomeFile() {
          const welcomeFile = createWelcomeFile()
          setActiveId(welcomeFile.id)
          addOpenedFile(welcomeFile.id)
        }
        try {
          const getOpenedCacheRes = await invoke<{ recent_workspaces: WorkspaceInfo[] }>(
            'get_opened_cache',
          )
          const recentWorkspaces = getOpenedCacheRes.recent_workspaces
          setRecentWorkspaces(recentWorkspaces)

          if (recentWorkspaces.length > 0) {
            const cacheStoreInitPromises = Promise.all([
              cacheStore.get<string[]>('openedFilePaths'),
              cacheStore.get<string>('activeFilePath'),
            ])
            const cacheStoreInitPromisesRes = await cacheStoreInitPromises
            readDirectory(recentWorkspaces[0].path).then((res) => {
              setFolderData(res)
              const openedFilePaths: string[] = cacheStoreInitPromisesRes[0] || []
              const activeFilePath = cacheStoreInitPromisesRes[1]

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
                cacheStore.set('openedFilePaths', openedFiles)
                if (state.activeId) {
                  cacheStore.set('activeFilePath', getFileObject(state.activeId)?.path)
                }
                cacheStore.save()
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
      bus.emit(payload)
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
    <StyleSheetManager shouldForwardProp={isPropValid}>
      <BaseStyle theme={themeColors} />
      <ThemeProvider theme={themeColors}>
        <MuiThemeProvider theme={muiTheme}>
          <GlobalStyles />
          <Routes>
            <Route index path='/' element={<Root />} />
            <Route path='/setting' element={<Setting />} />
          </Routes>
        </MuiThemeProvider>
      </ThemeProvider>
    </StyleSheetManager>
  )
}

export default App
