import {
  handleExternalWatchEvent,
  resetExternalFileChanges,
} from '@/components/EditorArea/externalFileChanges'
import { logger } from '@/helper/logger'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { rebaseFilePath } from '@/helper/pathIdentity'
import { dirname } from '@tauri-apps/api/path'
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
  const opened = useEditorStore((state) => state.opened)
  useFileCacheStore((state) => state.metadataRevision)
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace)

  const rootPath = folderData?.[0]?.path
  const loosePaths = JSON.stringify(
    opened
      .flatMap((id) => {
        const path = getFileObject(id)?.path
        return path && (!rootPath || rebaseFilePath(path, rootPath, rootPath) === undefined)
          ? [path]
          : []
      })
      .sort(),
  )

  useEffect(() => {
    let stopped = false
    const unwatchers: UnwatchFn[] = []
    void (async () => {
      const paths: string[] = JSON.parse(loosePaths)
      const parents = new Set(await Promise.all(paths.map((path) => dirname(path))))
      if (stopped) return
      await Promise.all(
        [...parents].map(async (parent) => {
          try {
            // Watch the parent so an atomic file replacement keeps being observed.
            const unwatch = await watch(
              parent,
              (event) => {
                void handleExternalWatchEvent(event)
              },
              { delayMs: 1000, recursive: false },
            )
            if (stopped) unwatch()
            else unwatchers.push(unwatch)
          } catch (error) {
            logger.error('Failed to watch an independent document', error)
          }
        }),
      )
    })().catch((error) => logger.error('Failed to resolve document directories', error))
    return () => {
      stopped = true
      unwatchers.forEach((unwatch) => unwatch())
    }
  }, [loosePaths])

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
