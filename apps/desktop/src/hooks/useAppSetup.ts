import useAiChatStore from '@/extensions/ai/useAiChatStore'
import bus from '@/helper/eventBus'
import { getFileObject, getFileObjectByPath, getSaveOpenedEditorEntries } from '@/helper/files'
import { readDirectory } from '@/helper/filesys'
import { checkUpdate } from '@/helper/updater'
import { i18nInit } from '@/i18n'
import { appSettingStoreSetup } from '@/services/app-setting'
import { checkUnsavedFiles } from '@/services/checkUnsavedFiles'
import { addExistingMarkdownFileEdit } from '@/services/editor-file'
import { getFileContent } from '@/services/file-info'
import { useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import type { WorkspaceInfo } from '@/stores/useOpenedCacheStore'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import { useSuspenseQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LazyStore } from '@tauri-apps/plugin-store'
import { once } from 'lodash'
import { useCallback, useEffect } from 'react'
import { toast } from 'zens'
import { useGlobalKeyboard, useGlobalOSInfo } from '.'
import __MF__ from '../context'
import { isArray } from '../helper'
import useExtensionsManagerStore from '../stores/useExtensionsManagerStore'
import useThemeStore, { isBuiltInTheme } from '../stores/useThemeStore'
import { useWorkspaceWatcherSetup } from './useWorkspaceWatcherSetup'

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

async function appWorkspaceSetup() {
  const { setRecentWorkspaces } = useOpenedCacheStore.getState()
  const { setFolderData, addOpenedFile, setActiveId } = useEditorStore.getState()

  console.log('window.openedUrls', window.openedUrls)

  if (window.openedUrls) {
    const openedPaths = window.openedUrls?.split(',').map((p) => {
      if (p.startsWith('file://')) {
        p = p.slice(7)
      }

      return p
    })

    window.openedUrls = null

    console.log('openedPaths', openedPaths)

    if (openedPaths.length === 1) {
      const openedPath = openedPaths[0]
      const isDir = await invoke<boolean>('is_dir', { path: openedPath })

      if (isDir) {
        await readDirectory(openedPath).then((res) => {
          setFolderData(res)
        })
      } else {
        const fileContent = await getFileContent({ filePath: openedPath })
        if (fileContent === null) return
        const fileName = openedPath.split('/').pop() || 'new-file.md'
        await addExistingMarkdownFileEdit({
          fileName,
          content: fileContent,
          path: openedPath,
        })
      }
    } else {
      let dirCount = 0
      let dir: string | null = null

      await Promise.all(
        openedPaths.map(async (openedPath) => {
          const isDir = await invoke<boolean>('is_dir', { path: openedPath })
          if (isDir) {
            dirCount++
            dir = openedPath
          }
        }),
      )

      if (dirCount > 0 && dir) {
        // TODO 这里只打开一个文件夹，后续可以通过多窗口实现
        await readDirectory(dir).then((res) => {
          setFolderData(res)
        })
      } else {
        await Promise.all(
          openedPaths.map(async (openedPath) => {
            const fileContent = await getFileContent({ filePath: openedPath })
            if (fileContent === null) return
            const fileName = openedPath.split('/').pop() || 'new-file.md'
            await addExistingMarkdownFileEdit({
              fileName,
              content: fileContent,
              path: openedPath,
            })
          }),
        )
      }
    }

    return
  }
  try {
    const cacheStore = await new LazyStore('.markflowy_cache.dat')

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
      await readDirectory(recentWorkspaces[0].path).then((res) => {
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

const useAppSetup = () => {
  const eventInit = useCallback(() => {
    const currentWindow = getCurrentWindow()

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
        console.log('有未保存的文件，阻止关闭')
        return false
      } else {
        handleCloseWindow()

        return true
      }
    })
    const unListenMenu = listen<string>('native:menu', ({ payload }) => {
      bus.emit(payload)
    })

    return () => {
      unListenMenu.then((fn) => fn())
      closeRequest.then((fn) => fn())
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
  useWorkspaceWatcherSetup()
}

export default useAppSetup
