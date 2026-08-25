import { create } from 'zustand'

export type ExternalFileChangeAction = 'reload' | 'overwrite'
export type ExternalFileChangeStatus = 'reloaded' | 'overwritten'

export type ExternalFileChangeNotice =
  | {
      diskRevision: string
      kind: 'conflict'
      resolving?: ExternalFileChangeAction
    }
  | {
      kind: 'updated'
      status: ExternalFileChangeStatus
      token: number
    }

interface ExternalFileChangeStore {
  notices: Record<string, ExternalFileChangeNotice>
  clear: (fileId: string) => void
  clearAll: () => void
  setNotice: (fileId: string, notice: ExternalFileChangeNotice) => void
}

const useExternalFileChangeStore = create<ExternalFileChangeStore>((set) => ({
  notices: {},
  clear: (fileId) =>
    set((state) => {
      if (!state.notices[fileId]) return state
      const { [fileId]: _, ...notices } = state.notices
      return { notices }
    }),
  clearAll: () => set({ notices: {} }),
  setNotice: (fileId, notice) =>
    set((state) => ({
      notices: {
        ...state.notices,
        [fileId]: notice,
      },
    })),
}))

export function isExternalFileSaveBlocked(fileId: string): boolean {
  return useExternalFileChangeStore.getState().notices[fileId]?.kind === 'conflict'
}

export default useExternalFileChangeStore
