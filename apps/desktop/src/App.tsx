import { BaseStyle } from '@markflowy/theme'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { invoke } from '@tauri-apps/api'
import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ThemeProvider, StyleSheetManager } from 'styled-components'
import { GlobalStyles } from './globalStyles'
import { useGlobalSettingData, useGlobalKeyboard, useGlobalOSInfo } from './hooks'
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
import { FlowyContextMenu, FlowyTheme } from '@flowy-ui/react'
import { FLOWYUI_CONTEXT_MENU_ID, FLOWYUI_THEME_ID } from './constants/flowy-ui'
import useThemeStore from './stores/useThemeStore'
import { excuteScript, isArray, once } from './helper'

// TODO refactor useGlobalSettingData use zustand
const confRef: { current: any } = { current: {} }

const onceLoadExtensions = once(() => {
  invoke<Record<string, any>>('extensions_init').then((res) => {
    if (isArray(res)) {
      try {
        res.map((extension) => {
          excuteScript(extension.script_text)
        })
        const updateCurThemeByName = useThemeStore.getState().setCurThemeByName
        updateCurThemeByName(confRef.current.theme)

      } catch (error) {
        // TODO need tips ui
      }
    }
  })
})

const App: FC = function () {
  useGlobalOSInfo()
  useGlobalKeyboard()
  const { setRecentWorkspaces } = useOpenedCacheStore()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, handler] = useGlobalSettingData()
  const { muiTheme, curTheme } = useThemeStore()
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
              confRef.current = res
              setSetting(res)
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
                  addOpenedFile(activeFile.id)
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
                cacheStore.set(
                  'activeFilePath',
                  state.activeId ? getFileObject(state.activeId)?.path : '',
                )

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

  useEffect(() => {
    onceLoadExtensions()
  }, [])

  const eventInit = useCallback(() => {
    const unListenMenu = listen<string>('native:menu', ({ payload }) => {
      bus.emit(payload)
    })

    return () => {
      unListenMenu.then((fn) => fn())
    }
  }, [])

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
      <ThemeProvider theme={curTheme?.styledContants || {}}>
        <BaseStyle theme={curTheme?.styledContants} />
        <GlobalStyles />
        <MuiThemeProvider theme={muiTheme}>
          <FlowyTheme id={FLOWYUI_THEME_ID} color={curTheme?.type === 'dark' ? 'darkest' : 'lightest'}>
            <Routes>
              <Route index path='/' element={<Root />} />
              <Route path='/setting' element={<Setting />} />
            </Routes>

            <FlowyContextMenu
              id={FLOWYUI_CONTEXT_MENU_ID}
              style={{
                zIndex: 1000000,
              }}
            />
          </FlowyTheme>
        </MuiThemeProvider>
      </ThemeProvider>
    </StyleSheetManager>
  )
}

export default App
