import { checkUpdate } from '@/helper/updater'
import { i18nInit } from '@/i18n'
import { appSettingStoreSetup } from '@/services/app-setting'
import { invoke } from '@tauri-apps/api/primitives'
import { isArray } from '../helper'
import useExtensionsManagerStore from '../stores/useExtensionsManagerStore'
import useThemeStore, { isBuiltInTheme } from '../stores/useThemeStore'
import { toast } from '@markflowy/components'
import { useCallback, useEffect } from 'react'
import __MF__ from '../context'
import { useSuspenseQuery } from '@tanstack/react-query'
import { listen } from '@tauri-apps/api/event'
import bus from '@/helper/eventBus'
import type { WorkspaceInfo } from '@/stores/useOpenedCacheStore'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import { useEditorStore } from '@/stores'
import { cacheStore } from '@/helper/cacheStore'
import { createWelcomeFile, readDirectory } from '@/helper/filesys'
import { getFileObject, getFileObjectByPath } from '@/helper/files'
import { useGlobalKeyboard, useGlobalOSInfo } from '.'
import { once } from 'lodash'

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
