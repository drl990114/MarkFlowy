import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isRecord, jsonStateStorage } from '@/stores/persistStorage'
import type { BookmarkViewConfig } from './types'

export const BOOKMARK_VIEW_STORAGE_KEY = 'mf:desktop:bookmark-library-view'

export interface BookmarkViewState {
  config: BookmarkViewConfig
  expandedGroupIds: string[]
  setGroupBy: (groupBy: BookmarkViewConfig['groupBy']) => void
  setSort: (sort: BookmarkViewConfig['sort']) => void
  toggleGroup: (id: string) => void
}

export const useBookmarkViewStore = create<BookmarkViewState>()(
  persist(
    (set) => ({
      config: { groupBy: 'none', sort: { field: 'title', direction: 'asc' } },
      expandedGroupIds: [],
      setGroupBy: (groupBy) => set((state) => ({ config: { ...state.config, groupBy } })),
      setSort: (sort) => set((state) => ({ config: { ...state.config, sort } })),
      toggleGroup: (id) =>
        set((state) => ({
          expandedGroupIds: state.expandedGroupIds.includes(id)
            ? state.expandedGroupIds.filter((groupId) => groupId !== id)
            : [...state.expandedGroupIds, id],
        })),
    }),
    {
      name: BOOKMARK_VIEW_STORAGE_KEY,
      version: 1,
      storage: jsonStateStorage(),
      partialize: ({ config, expandedGroupIds }) => ({ config, expandedGroupIds }),
      merge: (saved, current) => {
        const value = isRecord(saved) ? saved : {}
        const config = isRecord(value.config) ? value.config : {}
        const sort = isRecord(config.sort) ? config.sort : {}
        return {
          ...current,
          config: {
            groupBy: config.groupBy === 'tag' ? 'tag' : 'none',
            sort: {
              field: sort.field === 'createdAt' ? 'createdAt' : 'title',
              direction: sort.direction === 'desc' ? 'desc' : 'asc',
            },
          },
          expandedGroupIds: Array.isArray(value.expandedGroupIds)
            ? [
                ...new Set(
                  value.expandedGroupIds.filter((id): id is string => typeof id === 'string'),
                ),
              ]
            : [],
        }
      },
    },
  ),
)
