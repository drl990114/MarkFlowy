import { getPathIdentityKey, rebaseFilePath } from '@/helper/pathIdentity'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isRecord, jsonStateStorage } from './persistStorage'

export type EditorTextDirection = 'auto' | 'ltr' | 'rtl'
export type TextDirectionFile = { id: string; path?: string }

export const FILE_TEXT_DIRECTION_STORAGE_KEY = 'mf:desktop:file-text-direction'

export function normalizeEditorTextDirection(value: unknown): EditorTextDirection {
  return value === 'ltr' || value === 'rtl' ? value : 'auto'
}

export function getFileTextDirectionKey(id: string, path?: string): string {
  return path ? `path:${getPathIdentityKey(path)}` : `draft:${id}`
}

export interface FileTextDirectionState {
  directions: Partial<Record<string, EditorTextDirection>>
  setDirection: (file: TextDirectionFile, direction: EditorTextDirection | undefined) => void
  moveFile: (previous: TextDirectionFile, next: TextDirectionFile) => void
  rebasePaths: (oldPath: string, newPath: string) => void
}

/** Local presentation preferences; drafts stay in memory until first save. */
const useFileTextDirectionStore = create<FileTextDirectionState>()(
  persist(
    (set) => ({
      directions: {},
      setDirection: (file, direction) =>
        set((state) => {
          const key = getFileTextDirectionKey(file.id, file.path)
          if (state.directions[key] === direction) return state
          const directions = { ...state.directions }
          if (direction === undefined) delete directions[key]
          else directions[key] = direction
          return { directions }
        }),
      moveFile: (previous, next) =>
        set((state) => {
          const from = getFileTextDirectionKey(previous.id, previous.path)
          const to = getFileTextDirectionKey(next.id, next.path)
          if (
            from === to ||
            (state.directions[from] === undefined && state.directions[to] === undefined)
          )
            return state
          const directions = { ...state.directions }
          const direction = directions[from]
          delete directions[from]
          if (direction === undefined) delete directions[to]
          else directions[to] = direction
          return { directions }
        }),
      rebasePaths: (oldPath, newPath) =>
        set((state) => {
          const moves = Object.entries(state.directions).flatMap(([key, direction]) => {
            if (!key.startsWith('path:')) return []
            const path = rebaseFilePath(key.slice(5), oldPath, newPath)
            if (!path) return []
            const to = getFileTextDirectionKey('', path)
            return to === key ? [] : [{ from: key, to, direction }]
          })
          if (!moves.length) return state
          const directions = { ...state.directions }
          moves.forEach(({ from }) => delete directions[from])
          moves.forEach(({ to, direction }) => {
            directions[to] = direction
          })
          return { directions }
        }),
    }),
    {
      name: FILE_TEXT_DIRECTION_STORAGE_KEY,
      version: 1,
      storage: jsonStateStorage(),
      partialize: ({ directions }) => ({
        directions: Object.fromEntries(
          Object.entries(directions).filter(([key]) => key.startsWith('path:')),
        ),
      }),
      merge: (saved, current) => ({
        ...current,
        directions:
          isRecord(saved) && isRecord(saved.directions)
            ? (Object.fromEntries(
                Object.entries(saved.directions).filter(
                  ([key, value]) =>
                    key.startsWith('path:') &&
                    key.length > 5 &&
                    (value === 'auto' || value === 'ltr' || value === 'rtl'),
                ),
              ) as FileTextDirectionState['directions'])
            : {},
      }),
    },
  ),
)

export default useFileTextDirectionStore
