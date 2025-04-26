import bus from '@/helper/eventBus'
import { getFileObject, getFileObjectByPath } from '@/helper/files'
import { readDirectory } from '@/helper/filesys'
import { checkUpdate } from '@/helper/updater'
import { i18nInit } from '@/i18n'
import { appSettingStoreSetup } from '@/services/app-setting'
import { addExistingMarkdownFileEdit } from '@/services/editor-file'
import { getFileContent } from '@/services/file-info'
import { useEditorStore } from '@/stores'
import type { WorkspaceInfo } from '@/stores/useOpenedCacheStore'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import { useSuspenseQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { LazyStore } from '@tauri-apps/plugin-store'
import { once } from 'lodash'
import { useCallback, useEffect } from 'react'
import { toast } from 'zens'
import { useGlobalKeyboard, useGlobalOSInfo } from '.'
import __MF__ from '../context'
import { isArray } from '../helper'
import useExtensionsManagerStore from '../stores/useExtensionsManagerStore'
import useThemeStore, { isBuiltInTheme } from '../stores/useThemeStore'

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
    const openedPath = window.openedUrls.split('file://')[1]

    const isFolder = (path: string) => {
      const fileName = path.split('/').pop()
      return fileName === undefined || fileName === '' || fileName.includes('.')
    }

    console.log('isFolder', isFolder(openedPath))
    if (isFolder(openedPath)) {
      readDirectory(openedPath).then((res) => {
        setFolderData(res)
      })
    } else {
      const fileContent = await getFileContent({ filePath: openedPath })
      if (!fileContent) return
      const fileName = openedPath.split('/').pop() || 'new-file.md'
      await addExistingMarkdownFileEdit({
        fileName,
        content: fileContent,
        path: openedPath,
      })
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

const appSetup = once(async function () {
  const settingData = await appSettingStoreSetup()

  appWorkspaceSetup()

  window.removeEventListener('message', listener)
  window.addEventListener('message', listener)

  appThemeExtensionsSetup(settingData.theme)
  i18nInit({ lng: settingData.language })
  checkUpdate({ install: settingData.auto_update })

  return settingData
})

const useAppSetup = () => {
  useGlobalOSInfo()
  useGlobalKeyboard()

  // setup event listener
  const eventInit = useCallback(() => {
    const unListenMenu = listen<string>('native:menu', ({ payload }) => {
      bus.emit(payload)
    })

    return () => {
      unListenMenu.then((fn) => fn())
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
}

export default useAppSetup
