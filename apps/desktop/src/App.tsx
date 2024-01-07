import { BaseStyle } from '@markflowy/theme'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { ThemeProvider as MfThemeProvider, Notifications } from '@markflowy/components'
import { invoke } from '@tauri-apps/api/primitives'
import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ThemeProvider, StyleSheetManager } from 'styled-components'
import { GlobalStyles } from './globalStyles'
import { useGlobalSettingData, useGlobalKeyboard, useGlobalOSInfo } from './hooks'
import { i18nInit } from './i18n'
import { Root } from '@/router'
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
import useThemeStore from './stores/useThemeStore'
import { isArray, once } from './helper'
import { ContextMenu } from './components/UI/ContextMenu/ContextMenu'
import NiceModal from '@ebay/nice-modal-react'
import useExtensionsManagerStore from './stores/useExtensionsManagerStore'
import __MF__ from './context'
import { checkUpdate } from './helper/updater'

// TODO refactor useGlobalSettingData use zustand
export const confRef: { current: any } = { current: {} }

const themeInit = () => {
  const updateCurThemeByName = useThemeStore.getState().setCurThemeByName
  updateCurThemeByName(confRef.current.theme)
}

const onceSetup = once(async () => {
  invoke<Record<string, any>>('extensions_init').then((res) => {
    if (isArray(res)) {
      try {
        res.map((extension) => {
          useExtensionsManagerStore.getState().loadExtension(extension)
        })
      } catch (error) {
        // TODO need tips ui
      } finally {
        themeInit()
      }
    } else {
      themeInit()
    }
  })
})

const AppThemeProvider: FC<BaseComponentProps> = function ({ children }) {
  const { muiTheme, curTheme } = useThemeStore()

  return (
    <StyleSheetManager shouldForwardProp={isPropValid}>
      <MfThemeProvider theme={curTheme?.styledContants || {}}>
        <ThemeProvider theme={curTheme?.styledContants || {}}>
          <BaseStyle theme={curTheme?.styledContants} />
          <GlobalStyles />
          <NiceModal.Provider>
            <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
          </NiceModal.Provider>
        </ThemeProvider>
      </MfThemeProvider>
    </StyleSheetManager>
  )
}

const App: FC = function () {
  useGlobalOSInfo()
  useGlobalKeyboard()
  const { setRecentWorkspaces } = useOpenedCacheStore()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, handler] = useGlobalSettingData()
  const editorStore = useEditorStore()
  const { setFolderData, addOpenedFile, setActiveId } = editorStore
  const { setSetting } = handler
  const isWeb = (window as any).__TAURI__ === undefined
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
              checkUpdate({ install: res.auto_update })
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
    onceSetup()
    const listener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return
      }

      const { key, payload } = event.data

      switch (key) {
        case 'registerTheme':
          __MF__.theme.registerTheme(payload)
          break
      }
    }

    window.addEventListener('message', listener)

    return () => {
      window.removeEventListener('message', listener)
    }
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

  return (
    <AppThemeProvider>
      <Routes>
        <Route index path='/' element={<Root />} />
        {/* <Route path='/setting' element={<Setting />} /> */}
      </Routes>
      <ContextMenu />
      <Notifications />
    </AppThemeProvider>
  )
}

export default App
