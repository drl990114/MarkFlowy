import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isRecord, jsonStateStorage } from '@/stores/persistStorage'

export const COMMAND_HISTORY_KEY = 'mf:command-palette-history'
const LIMIT = 20

export function normalizeCommandHistory(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0)),
      ].slice(0, LIMIT)
    : []
}

interface CommandHistoryState {
  recent: string[]
  record: (id: string) => void
}

export const useCommandHistoryStore = create<CommandHistoryState>()(
  persist(
    (set) => ({
      recent: [],
      record: (id) => set(({ recent }) => ({ recent: normalizeCommandHistory([id, ...recent]) })),
    }),
    {
      name: COMMAND_HISTORY_KEY,
      version: 1,
      storage: jsonStateStorage(),
      partialize: ({ recent }) => ({ recent }),
      merge: (saved, current) => ({
        ...current,
        recent: normalizeCommandHistory(isRecord(saved) ? saved.recent : undefined),
      }),
    },
  ),
)
