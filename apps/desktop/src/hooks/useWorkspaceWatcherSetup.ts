import { useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { useEffect } from 'react'

export const useWorkspaceWatcherSetup = () => {
  const { folderData } = useEditorStore()

  const rootPath = folderData?.[0]?.path

  useEffect(() => {
    const setupWatcher = async () => {
      try {
        await invoke('stop_file_watcher', {
          key: 'workspace',
        })
      } catch (error) {}

      console.log('rootPath', rootPath)
      if (rootPath) {
        invoke('watch_file', {
          key: 'workspace',
          path: rootPath,
        })
      }
    }

    setupWatcher()

    return () => {
      invoke('stop_file_watcher', {
        key: 'workspace',
      })
    }
  }, [rootPath])
}
