import {
  handleExternalWatchEvent,
  resetExternalFileChanges,
} from '@/components/EditorArea/externalFileChanges'
import { logger } from '@/helper/logger'
import { currentWindow } from '@/services/windows'
import { getWorkspace, type WorkSpace } from '@/services/workspace'
import { useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { watch, type UnwatchFn } from '@tauri-apps/plugin-fs'
import { createGlobalStore } from 'hox'
import { useEffect } from 'react'
import { create } from 'zustand'

export const useWorkspaceStore = create<WorkSpaceStore>((set) => {
  return {
    workspace: null,
    setWorkspace: (ws) => {
      set(() => {
        return {
          workspace: ws,
        }
      })
    },
  }
})

interface WorkSpaceStore {
  workspace: WorkSpace | null
  setWorkspace: (ws: WorkSpace | null) => void
}

export const useWorkspaceWatcher = () => {
  const folderData = useEditorStore((state) => state.folderData)
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace)

  const rootPath = folderData?.[0]?.path

  useEffect(() => {
    let stopped = false
    let unwatch: UnwatchFn | undefined
    resetExternalFileChanges()

    const updateWorkspaceAndWatcher = async () => {
      const ws = await getWorkspace()
      if (stopped) return
      setWorkspace(ws)

      try {
        await invoke('update_window_path', {
          windowLabel: currentWindow.label,
          newPath: rootPath,
        })
      } catch (error) {
        logger.warn('Failed to update the window workspace path', error)
      }

      if (rootPath) {
        logger.info('rootPath', rootPath)
        try {
          const stopWatching = await watch(
            rootPath,
            (event) => {
              void handleExternalWatchEvent(event)
            },
            {
              delayMs: 1000,
              recursive: true,
            },
          )
          if (stopped) {
            stopWatching()
          } else {
            unwatch = stopWatching
          }
        } catch (error) {
          logger.error('Failed to watch workspace files', error)
        }
      }
    }

    void updateWorkspaceAndWatcher()

    return () => {
      stopped = true
      unwatch?.()
    }
  }, [rootPath, setWorkspace])
}
const [useGlobalWorkspaceWatcher] = createGlobalStore(useWorkspaceWatcher)

export default useGlobalWorkspaceWatcher
