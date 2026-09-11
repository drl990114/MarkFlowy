import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isRecord, jsonStateStorage } from '@/stores/persistStorage'
import { workspaceStorageKey } from '@/stores/workspacePersistence'
import { getPathIdentityKey } from '@/helper/pathIdentity'

export function createSearchStore(workspace: string) {
  return create<SearchStore>()(
    persist(
      (set) => ({
        searchKeyword: '',
        resultQuery: '',
        resultCaseSensitive: false,
        caseSensitive: false,
        activeIndex: 0,
        activeMatch: undefined,
        resultList: [],
        expandedPaths: {},
        hasSearched: false,
        setSearchState: (state) => set(state),
        addSearchResult: (resultList) => set({ resultList }),
        clearSearchResult: () => set({ resultList: [] }),
      }),
      {
        name: workspaceStorageKey('search', workspace),
        version: 1,
        storage: jsonStateStorage(),
        // Results contain file content and can become stale while the app is closed.
        partialize: ({
          searchKeyword,
          caseSensitive,
          expandedPaths,
          activeIndex,
          activeMatch,
          hasSearched,
        }) => ({
          searchKeyword,
          caseSensitive,
          expandedPaths,
          activeIndex,
          activeMatch,
          hasSearched,
        }),
        merge: (saved, current) => {
          const state = isRecord(saved) ? saved : {}
          return {
            ...current,
            searchKeyword: typeof state.searchKeyword === 'string' ? state.searchKeyword : '',
            caseSensitive: state.caseSensitive === true,
            hasSearched: state.hasSearched === true,
            activeIndex:
              typeof state.activeIndex === 'number' && Number.isSafeInteger(state.activeIndex)
                ? Math.max(0, state.activeIndex)
                : 0,
            activeMatch:
              isRecord(state.activeMatch) &&
              typeof state.activeMatch.path === 'string' &&
              typeof state.activeMatch.line === 'number' &&
              Number.isSafeInteger(state.activeMatch.line) &&
              state.activeMatch.line >= 1 &&
              typeof state.activeMatch.startColumn === 'number' &&
              Number.isSafeInteger(state.activeMatch.startColumn) &&
              state.activeMatch.startColumn >= 0
                ? {
                    path: state.activeMatch.path,
                    line: state.activeMatch.line,
                    startColumn: state.activeMatch.startColumn,
                  }
                : undefined,
            expandedPaths: isRecord(state.expandedPaths)
              ? (Object.fromEntries(
                  Object.entries(state.expandedPaths).filter(
                    ([, value]) => typeof value === 'boolean',
                  ),
                ) as Record<string, boolean>)
              : {},
          }
        },
      },
    ),
  )
}

const stores = new Map<string, ReturnType<typeof createSearchStore>>()
export function getSearchStore(workspace: string) {
  const key = getPathIdentityKey(workspace)
  let store = stores.get(key)
  if (!store) {
    store = createSearchStore(workspace)
    stores.set(key, store)
  }
  return store
}

type SearchInfoMatch = {
  id: string
  content: string
  line: number
}
export interface SearchInfo {
  id: string
  ext: string
  is_folder: boolean
  matches: SearchInfoMatch[]
  name: string
  path: string
  relative_path: string
}

export interface SearchStore {
  expandedPaths: Record<string, boolean>
  hasSearched: boolean
  searchKeyword: string
  resultQuery: string
  resultCaseSensitive: boolean
  caseSensitive: boolean
  activeIndex: number
  activeMatch?: { path: string; line: number; startColumn: number }
  setSearchState: (state: Partial<SearchStore>) => void
  resultList: SearchInfo[]
  addSearchResult: (result: SearchInfo[]) => void
  clearSearchResult: () => void
}
