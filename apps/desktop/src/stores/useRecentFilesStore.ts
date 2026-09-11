import { getPathIdentityKey, rebaseFilePath } from '@/helper/pathIdentity'
import { create } from 'zustand'

export const MAX_RECENT_FILES = 200

export type RecentFile = { path: string; fileId?: string } | { path?: undefined; fileId: string }

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
  visit: (file: RecentFile) => void
  replaceEntries: (entries: readonly RecentFile[]) => void
  rebasePaths: (oldPath: string, newPath: string) => void
  removePath: (path: string) => void
}

const useRecentFilesStore = create<RecentFilesStore>((set) => ({
  entries: [],
  restoring: false,
  visit: (file) =>
    set((state) => {
      if (state.restoring) return state
      if (state.entries[0]?.path === file.path && state.entries[0]?.fileId === file.fileId) {
        return state
      }
      return { entries: uniqueRecentFiles([file, ...state.entries]) }
    }),
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
  rebasePaths: (oldPath, newPath) =>
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
    }),
  removePath: (path) =>
    set((state) => {
      if (state.restoring) return state
      const entries = state.entries.filter(
        (entry) => !entry.path || rebaseFilePath(entry.path, path, path) === undefined,
      )
      return entries.length === state.entries.length ? state : { entries }
    }),
}))

export default useRecentFilesStore
