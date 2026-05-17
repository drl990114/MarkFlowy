import useAiChatStore from '@/extensions/ai/useAiChatStore'
import bus from '@/helper/eventBus'
import { loadLocalThemeCss } from '@/helper/extensions'
import { getFileObject, getFileObjectByPath, getSaveOpenedEditorEntries } from '@/helper/files'
import { getFileNameFromPath, readDirectory } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { checkUpdate } from '@/helper/updater'
import { i18nInit } from '@/i18n'
import { appSettingStoreSetup } from '@/services/app-setting'
import { checkUnsavedFiles } from '@/services/checkUnsavedFiles'
import { addExistingMarkdownFileEdit } from '@/services/editor-file'
import { getFileContent } from '@/services/file-info'
import { createNewWindow, currentWindow } from '@/services/windows'
import { useCommandStore, useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import type { WorkspaceInfo } from '@/stores/useOpenedCacheStore'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import { useSuspenseQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { LazyStore } from '@tauri-apps/plugin-store'
import { once } from 'lodash'
import { useCallback, useEffect } from 'react'
import { toast } from 'zens'
import { useGlobalKeyboard, useGlobalOSInfo } from '.'
import __MF__ from '../context'
import { isArray } from '../helper'
import useExtensionsManagerStore from '../stores/useExtensionsManagerStore'
import useThemeStore, { isBuiltInTheme } from '../stores/useThemeStore'
import useWorkspaceWatcher from './useWorkspaceWatcher'

interface LocalTheme {
  id: string
  name: string
  path: string
  css_content: string
}

async function appThemeExtensionsSetup(curTheme: string) {
  try {
    if (isBuiltInTheme(curTheme)) {
      useThemeStore.getState().setCurThemeByName(curTheme)
    }

    logger.debug('Loading local themes...')
    const localThemes = await invoke<LocalTheme[]>('load_local_themes')
    logger.debug('Local themes loaded:', localThemes.length)
    
    if (localThemes.length > 0) {
      const cssContents = localThemes.map((t) => t.css_content)
      loadLocalThemeCss(cssContents)
    }

    logger.debug('Loading themes...')
    invoke<Record<string, any>>('load_themes').then((res) => {
      logger.debug('Themes loaded:', res)
      if (isArray(res)) {
        try {
          res.map((extension) => {
            useExtensionsManagerStore.getState().loadExtension(extension)
          })
        } catch (error) {
          logger.error('Failed to load extensions:', error)
          toast.error(`Failed to load extensions: ${error}`)
        } finally {
          useThemeStore.getState().setCurThemeByName(curTheme)
        }
      } else {
        useThemeStore.getState().setCurThemeByName(curTheme)
      }
    }).catch((error) => {
      logger.error('Failed to invoke load_themes:', error)
      useThemeStore.getState().setCurThemeByName(curTheme)
    })
  } catch (error) {
    logger.error('Failed to setup theme extensions:', error)
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    useThemeStore.getState().setCurThemeByName(curTheme)
  }
}

async function handleOpenedPaths(openedPaths: string[]) {
  const { setFolderData, addOpenedFile, setActiveId } = useEditorStore.getState()

  logger.debug('handleOpenedPaths', openedPaths)

  const handleOpenedPath = async (openedPath: string) => {
    const isDir = await invoke<boolean>('is_dir', { path: openedPath })

    if (isDir) {
      const rootPath = useEditorStore.getState().getRootPath()
      if (openedPath === rootPath) {
        return
      }
      if (rootPath || openedPaths.length > 1) {
        await createNewWindow({ path: openedPath })
      } else {
        await readDirectory(openedPath).then((res) => {
          setFolderData(res)
        })
      }
    } else {
      const existingFile = getFileObjectByPath(openedPath)
      if (existingFile) {
        setActiveId(existingFile.id)
        addOpenedFile(existingFile.id)
      } else {
        const fileContent = await getFileContent({ filePath: openedPath })
        if (fileContent === null) return
        const fileName = getFileNameFromPath(openedPath) || 'new-file.md'
        await addExistingMarkdownFileEdit({
          fileName,
          content: fileContent,
          path: openedPath,
        })
      }
    }
  }

  if (openedPaths.length === 1) {
    await handleOpenedPath(openedPaths[0])
  } else {
    await Promise.all(openedPaths.map(handleOpenedPath))
  }
}

async function appWorkspaceSetup() {
  const { setRecentWorkspaces, clearRecentWorkspaces } = useOpenedCacheStore.getState()
  const { setFolderData, addOpenedFile, setActiveId } = useEditorStore.getState()
  logger.debug('=== appWorkspaceSetup: Checking window.openedUrls ===')
  logger.debug('window.openedUrls', window.openedUrls)

  try {
    logger.debug('Creating LazyStore for workspace cache...')
    const cacheStore = await new LazyStore('.markflowy_workspaces.dat')
    logger.debug('LazyStore created successfully')

    logger.debug('Invoking get_opened_cache...')
    const getOpenedCacheRes = await invoke<{ recent_workspaces: WorkspaceInfo[] }>(
      'get_opened_cache',
    )
    logger.debug('get_opened_cache result:', getOpenedCacheRes)
    
    const recentWorkspaces = getOpenedCacheRes.recent_workspaces
    setRecentWorkspaces(recentWorkspaces)

    if (window.openedUrls) {
      logger.debug('Processing window.openedUrls:', window.openedUrls)
      const openedPaths = window.openedUrls?.split(',').map((p) => {
        if (p.startsWith('file://')) {
          p = p.slice(7)
        }

        return p
      })

      window.openedUrls = null

      await handleOpenedPaths(openedPaths)
      return
    }

    if (recentWorkspaces.length > 0) {
      logger.debug('Found recent workspaces:', recentWorkspaces)
      const targetWorkspacePath = recentWorkspaces[0].path
      logger.debug('Target workspace path:', targetWorkspacePath)
      
      const cacheStoreInitPromises = Promise.all([
        cacheStore.get<{
          openedFilePaths: string[]
          activeFilePath: string
        }>(targetWorkspacePath),
      ])
      const cacheStoreInitPromisesRes = await cacheStoreInitPromises
      logger.debug('Cache store init result:', cacheStoreInitPromisesRes)
      
      logger.debug('Reading directory:', targetWorkspacePath)
      try {
        const res = await readDirectory(targetWorkspacePath)
        logger.debug('Directory read successfully, file count:', res.length)
        setFolderData(res)
        const { openedFilePaths, activeFilePath } = cacheStoreInitPromisesRes[0] || {}

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
        }

        useEditorStore.subscribe((state) => {
          const rootPath = state.getRootPath()
          if (rootPath) {
            const openedFiles = state.opened.map((fileId) => {
              const file = getFileObject(fileId)
              return file.path
            })

            cacheStore.set(rootPath, {
              openedFilePaths: openedFiles,
              activeFilePath: state.activeId ? getFileObject(state.activeId)?.path : '',
            })
            cacheStore.save()
          }
        })
      } catch (error) {
        logger.error('Failed to read directory:', targetWorkspacePath, error)
        logger.error('This might be due to sandbox restrictions or the directory no longer exists')
        logger.error('Clearing recent workspaces cache...')
        
        await clearRecentWorkspaces()
        
        toast.error('无法访问上次的工作区，请重新选择文件夹。这可能是由于沙盒权限限制导致的。')
      }
    } else {
      logger.debug('No recent workspaces found')
    }
  } catch (error) {
    logger.error('Failed to load workspace', error)
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
  }
}

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

const useMainStoreSetup = () => {
  useAppSettingStore()
  useAiChatStore()
}

const appSetup = once(async function () {
  useMainStoreSetup()

  const settingData = await appSettingStoreSetup()

  window.removeEventListener('message', listener)
  window.addEventListener('message', listener)

  appThemeExtensionsSetup(settingData.theme)
  await i18nInit({ lng: settingData.language })
  checkUpdate({ install: settingData.auto_update })

  // Initialize zoom level based on webview_zoom setting
  if (settingData.webview_zoom) {
    const webview = getCurrentWebview()
    webview.setZoom(Number(settingData.webview_zoom))
  }

  await appWorkspaceSetup()

  return settingData
})

const useFontfamilySetup = () => {
  const { osType } = useGlobalOSInfo()

  if (osType === 'macos') {
    document.body.style.fontFamily = 'SF Pro,-apple-system,BlinkMacSystemFont,sans-serif'
  } else if (osType === 'windows') {
    document.body.style.fontFamily = 'Segoe UI, Roboto, Helvetica, Arial, sans-serif'
  } else if (osType === 'linux') {
    document.body.style.fontFamily = 'Ubuntu, Roboto, Helvetica, Arial, sans-serif'
  }
}

const useAppSetup = () => {
  const eventInit = useCallback(() => {
    const closeRequest = currentWindow.listen('tauri://close-requested', async () => {
      const handleCloseWindow = async () => {
        closeRequest.then((fn) => fn())
        currentWindow.destroy()
      }

      const openedIds = useEditorStore.getState().opened
      if (
        checkUnsavedFiles({
          fileIds: openedIds,
          onSaveAndClose: async (hasUnsavedFileIds) => {
            const saves = hasUnsavedFileIds.map((otherId) => getSaveOpenedEditorEntries(otherId))
            await Promise.all(saves.map((saveHandler) => saveHandler?.()))
            handleCloseWindow()
          },
          onUnsavedAndClose: () => {
            handleCloseWindow()
          },
        }) > 0
      ) {
        return false
      } else {
        handleCloseWindow()

        return true
      }
    })

    const settingDataUpdate = currentWindow.listen('app_conf_change', async () => {
      appSettingStoreSetup()
    })

    const unListenMenu = currentWindow.listen<string>('native:menu', ({ payload }) => {
      bus.emit(payload)
      useCommandStore.getState().execute(payload)
    })

    const unListenOpenedUrls = currentWindow.listen<string>('opened-urls', async ({ payload }) => {
      logger.debug('Received opened-urls event:', payload)
      if (payload) {
        const openedPaths = payload.split(',').map((p) => {
          if (p.startsWith('file://')) {
            return p.slice(7)
          }
          return p
        })
        await handleOpenedPaths(openedPaths)
        currentWindow.setFocus()
      }
    })

    return () => {
      unListenMenu.then((fn) => fn())
      closeRequest.then((fn) => fn())
      unListenOpenedUrls.then((fn) => fn())
      settingDataUpdate.then((fn) => fn())
    }
  }, [])

  // native event listener
  useEffect(() => {
    const unlisten = eventInit()

    return () => {
      unlisten()
    }
  }, [eventInit])

  useSuspenseQuery({
    queryKey: ['appSetup'],
    queryFn: appSetup,
  })

  useGlobalOSInfo()
  useGlobalKeyboard()
  useWorkspaceWatcher()
  useFontfamilySetup()
}

export default useAppSetup
