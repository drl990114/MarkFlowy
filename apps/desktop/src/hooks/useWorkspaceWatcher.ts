import { logger } from '@/helper/logger'
import { currentWindow } from '@/services/windows'
import { getWorkspace, WorkSpace } from '@/services/workspace'
import { useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { createGlobalStore } from 'hox'
import { useEffect, useRef } from 'react'
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

const useWorkspaceWatcher = () => {
  const { folderData } = useEditorStore()
  const { setWorkspace } = useWorkspaceStore()

  const rootPath = folderData?.[0]?.path
  const prevRootPathRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (rootPath === prevRootPathRef.current) {
      return
    }
    prevRootPathRef.current = rootPath

    let stopped = false

    const updateWorkspaceAndWatcher = async () => {
      const ws = await getWorkspace()
      if (stopped) return
      setWorkspace(ws)

      try {
        await invoke('update_window_path', {
          windowLabel: currentWindow.label,
          newPath: rootPath,
        })
      } catch (error) { }

      if (rootPath) {
        logger.info('rootPath', rootPath)
        try {
          await invoke('stop_file_watcher', {
            key: 'workspace',
          })
        } catch (error) { }

        await invoke('watch_file', {
          key: 'workspace',
          path: rootPath,
          windowLabel: currentWindow.label,
        })
      }
    }

    updateWorkspaceAndWatcher()

    return () => {
      stopped = true
      invoke('stop_file_watcher', {
        key: 'workspace',
      })
    }
  }, [rootPath, setWorkspace])
}
const [useGlobalWorkspaceWatcher] = createGlobalStore(useWorkspaceWatcher)

export default useGlobalWorkspaceWatcher
