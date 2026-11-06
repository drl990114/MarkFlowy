import { getPathIdentityKey, rebaseFilePath } from '@/helper/pathIdentity'
import { create } from 'zustand'

export const MAX_RECENT_FILES = 200

export type RecentFile = { path: string; fileId?: string } | { path?: undefined; fileId: string }

export type RecentFileMutation =
  | { type: 'visit'; path: string; afterPath?: string }
  | { type: 'clear' }
  | { type: 'rebase'; path: string; newPath: string }
  | { type: 'remove'; path: string }

const mutationListeners = new Set<(mutation: RecentFileMutation) => void>()
export function subscribeRecentFileMutations(listener: (mutation: RecentFileMutation) => void) {
  mutationListeners.add(listener)
  return () => {
    mutationListeners.delete(listener)
  }
}
const publish = (mutation: RecentFileMutation) => {
  for (const listener of mutationListeners) listener(mutation)
}

export function getRecentFileKey(file: RecentFile): string {
  return file.path ? `path:${getPathIdentityKey(file.path)}` : `file:${file.fileId}`
}

function uniqueRecentFiles(entries: readonly RecentFile[]): RecentFile[] {
  const seen = new Set<string>()
  return entries
    .filter((entry) => {
      const key = getRecentFileKey(entry)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_RECENT_FILES)
}

export function parseRecentFilePaths(value: unknown): RecentFile[] {
  if (!Array.isArray(value)) return []
  return uniqueRecentFiles(
    value.flatMap((path: unknown) =>
      typeof path === 'string' && path.trim() && !path.includes('\0') ? [{ path }] : [],
    ),
  )
}

interface RecentFilesStore {
  rootPath?: string
  entries: RecentFile[]
  restoring: boolean
  shared: boolean
  visit: (file: RecentFile) => void
  clear: () => void
  replaceEntries: (entries: readonly RecentFile[]) => void
  rebasePaths: (oldPath: string, newPath: string) => void
  removePath: (path: string) => void
  updateFilePath: (fileId: string, path: string) => void
}

const useRecentFilesStore = create<RecentFilesStore>((set, get) => ({
  entries: [],
  restoring: false,
  shared: false,
  visit: (file) => {
    if (get().restoring) return
    set((state) => {
      if (state.restoring) return state
      if (state.entries[0]?.path === file.path && state.entries[0]?.fileId === file.fileId) {
        return state
      }
      return { entries: uniqueRecentFiles([file, ...state.entries]) }
    })
    if (file.path) publish({ type: 'visit', path: file.path })
  },
  clear: () => {
    if (get().restoring) return
    set({ entries: [] })
    publish({ type: 'clear' })
  },
  updateFilePath: (fileId, path) => {
    const state = get()
    if (state.restoring) return
    const entry = state.entries.find((file) => file.fileId === fileId)
    if (!entry || entry.path === path) return
    if (entry.path) state.rebasePaths(entry.path, path)
    else {
      state.replaceEntries(state.entries.map((file) => (file === entry ? { path, fileId } : file)))
      const afterPath = state.entries
        .slice(0, state.entries.indexOf(entry))
        .reverse()
        .find((file) => file.path)?.path
      publish({ type: 'visit', path, ...(afterPath ? { afterPath } : {}) })
    }
  },
  replaceEntries: (entries) =>
    set((state) => {
      const next = uniqueRecentFiles(entries)
      return next.length === state.entries.length &&
        next.every(
          (entry, index) =>
            entry.path === state.entries[index].path &&
            entry.fileId === state.entries[index].fileId,
        )
        ? state
        : { entries: next }
    }),
  rebasePaths: (oldPath, newPath) => {
    if (get().restoring) return
    set((state) => {
      if (state.restoring) return state
      let changed = false
      const entries = state.entries.map((entry) => {
        if (!entry.path) return entry
        const path = rebaseFilePath(entry.path, oldPath, newPath)
        if (!path || path === entry.path) return entry
        changed = true
        return { ...entry, path }
      })
      return changed ? { entries: uniqueRecentFiles(entries) } : state
    })
    publish({ type: 'rebase', path: oldPath, newPath })
  },
  removePath: (path) => {
    if (get().restoring) return
    set((state) => {
      if (state.restoring) return state
      const entries = state.entries.filter(
        (entry) => !entry.path || rebaseFilePath(entry.path, path, path) === undefined,
      )
      return entries.length === state.entries.length ? state : { entries }
    })
    publish({ type: 'remove', path })
  },
}))

export default useRecentFilesStore
