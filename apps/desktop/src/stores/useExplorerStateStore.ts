import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isRecord, jsonStateStorage } from './persistStorage'
import { workspaceStorageKey } from './workspacePersistence'

export type ExplorerSortDirection = 'asc' | 'desc'

interface ExplorerState {
  expandedPaths: string[] | undefined
  setExpandedPaths: (paths: string[]) => void
  sortDirection: ExplorerSortDirection
  setSortDirection: (direction: ExplorerSortDirection) => void
}

export function createExplorerStateStore(workspace: string) {
  return create<ExplorerState>()(
    persist(
      (set) => ({
        expandedPaths: undefined,
        setExpandedPaths: (expandedPaths) => set({ expandedPaths }),
        sortDirection: 'asc',
        setSortDirection: (sortDirection) => set({ sortDirection }),
      }),
      {
        name: workspaceStorageKey('explorer', workspace),
        version: 1,
        storage: jsonStateStorage(),
        partialize: ({ expandedPaths, sortDirection }) => ({ expandedPaths, sortDirection }),
        merge: (saved, current) => ({
          ...current,
          sortDirection: isRecord(saved) && saved.sortDirection === 'desc' ? 'desc' : 'asc',
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
