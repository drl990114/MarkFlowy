import useAiChatStore from '@/extensions/ai/useAiChatStore'
import bus from '@/helper/eventBus'
import { getFileObject, getFileObjectByPath, getSaveOpenedEditorEntries } from '@/helper/files'
import { getFileNameFromPath, readDirectory } from '@/helper/filesys'
import { checkUpdate } from '@/helper/updater'
import { i18nInit } from '@/i18n'
import { appSettingStoreSetup } from '@/services/app-setting'
import { checkUnsavedFiles } from '@/services/checkUnsavedFiles'
import { addExistingMarkdownFileEdit } from '@/services/editor-file'
import { getFileContent } from '@/services/file-info'
import { createNewWindow, currentWindow } from '@/services/windows'
import { useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import type { WorkspaceInfo } from '@/stores/useOpenedCacheStore'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import { useSuspenseQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
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

async function appThemeExtensionsSetup(curTheme: string) {
  if (isBuiltInTheme(curTheme)) {
    useThemeStore.getState().setCurThemeByName(curTheme)
  }

  invoke<Record<string, any>>('load_themes').then((res) => {
    if (isArray(res)) {
      try {
        res.map((extension) => {
          useExtensionsManagerStore.getState().loadExtension(extension)
        })
      } catch (error) {
        toast.error(`Failed to load extensions: ${error}`)
      } finally {
        useThemeStore.getState().setCurThemeByName(curTheme)
      }
    } else {
      useThemeStore.getState().setCurThemeByName(curTheme)
    }
  })
}

async function handleOpenedPaths(openedPaths: string[]) {
  const { setFolderData, addOpenedFile, setActiveId } = useEditorStore.getState()

  console.log('handleOpenedPaths', openedPaths)

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
  const { setRecentWorkspaces } = useOpenedCacheStore.getState()
  const { setFolderData, addOpenedFile, setActiveId } = useEditorStore.getState()
  console.log('=== appWorkspaceSetup: Checking window.openedUrls ===')
  console.log('window.openedUrls', window.openedUrls)
  console.log('window.openedUrls type:', typeof window.openedUrls)

  try {
    const cacheStore = await new LazyStore('.markflowy_workspaces.dat')

    const getOpenedCacheRes = await invoke<{ recent_workspaces: WorkspaceInfo[] }>(
      'get_opened_cache',
    )
    const recentWorkspaces = getOpenedCacheRes.recent_workspaces
    setRecentWorkspaces(recentWorkspaces)

    if (window.openedUrls) {
      console.log('Processing window.openedUrls:', window.openedUrls)
      const openedPaths = window.openedUrls?.split(',').map((p) => {
        console.log('Processing path from openedUrls:', p)
        if (p.startsWith('file://')) {
          p = p.slice(7)
          console.log('Removed file:// prefix:', p)
        }

        return p
      })

      console.log('Final openedPaths:', openedPaths)
      window.openedUrls = null

      await handleOpenedPaths(openedPaths)
      return
    }

    if (recentWorkspaces.length > 0) {
      const targetWorkspacePath = recentWorkspaces[0].path
      const cacheStoreInitPromises = Promise.all([
        cacheStore.get<{
          openedFilePaths: string[]
          activeFilePath: string
        }>(targetWorkspacePath),
      ])
      const cacheStoreInitPromisesRes = await cacheStoreInitPromises
      await readDirectory(targetWorkspacePath).then((res) => {
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
      })
    }
  } catch (error) {
    console.error('Failed to load workspace', error)
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
  i18nInit({ lng: settingData.language })
  checkUpdate({ install: settingData.auto_update })

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
    })

    const unListenOpenedUrls = currentWindow.listen<string>('opened-urls', async ({ payload }) => {
      console.log('Received opened-urls event:', payload)
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
    queryKey: [],
    queryFn: appSetup,
  })

  useGlobalOSInfo()
  useGlobalKeyboard()
  useWorkspaceWatcher()
  useFontfamilySetup()
}

export default useAppSetup
