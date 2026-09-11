import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isRecord, jsonStateStorage } from './persistStorage'
import { workspaceStorageKey } from './workspacePersistence'

interface ExplorerState {
  expandedPaths: string[] | undefined
  setExpandedPaths: (paths: string[]) => void
}

export function createExplorerStateStore(workspace: string) {
  return create<ExplorerState>()(
    persist(
      (set) => ({
        expandedPaths: undefined,
        setExpandedPaths: (expandedPaths) => set({ expandedPaths }),
      }),
      {
        name: workspaceStorageKey('explorer', workspace),
        version: 1,
        storage: jsonStateStorage(),
        partialize: ({ expandedPaths }) => ({ expandedPaths }),
        merge: (saved, current) => ({
          ...current,
          expandedPaths:
            isRecord(saved) && Array.isArray(saved.expandedPaths)
              ? [
                  ...new Set(
                    saved.expandedPaths.filter((path): path is string => typeof path === 'string'),
                  ),
                ]
              : undefined,
        }),
      },
    ),
  )
}

const stores = new Map<string, ReturnType<typeof createExplorerStateStore>>()
export function getExplorerStateStore(workspace: string) {
  const key = workspaceStorageKey('explorer', workspace)
  let store = stores.get(key)
  if (!store) {
    store = createExplorerStateStore(workspace)
    stores.set(key, store)
  }
  return store
}
