import { invoke } from '@tauri-apps/api'
import { create } from 'zustand'

const useOpenedCacheStore = create<OpenedCacheStore>((set) => {
  return {
    recentWorkspaces: [],
    setRecentWorkspaces: (recentWorkspaces: WorkspaceInfo[]) => {
      set((state) => {
        return {
          ...state,
          recentWorkspaces,
        }
      })
    },
    addRecentWorkspaces: async (workspace: WorkspaceInfo) => {
      const openedCache = await invoke<{ recent_workspaces: WorkspaceInfo[] }>(
        'add_recent_workspace',
        { workspace },
      )

      set((state) => {
        return {
          ...state,
          recentWorkspaces: openedCache.recent_workspaces,
        }
      })
    },
    clearRecentWorkspaces: async () => {
      const openedCache = await invoke<{ recent_workspaces: WorkspaceInfo[] }>(
        'clear_recent_workspaces',
      )

      set((state) => {
        return {
          ...state,
          recentWorkspaces: openedCache.recent_workspaces,
        }
      })
    }
  }
})

type OpenedCacheStore = {
  recentWorkspaces: WorkspaceInfo[]
  setRecentWorkspaces: (workspaces: WorkspaceInfo[]) => void
  addRecentWorkspaces: (workspace: WorkspaceInfo) => void
  clearRecentWorkspaces: () => void
}

export default useOpenedCacheStore

export type WorkspaceInfo = {
  path: string
}
