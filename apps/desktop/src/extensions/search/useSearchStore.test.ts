import { beforeEach, describe, expect, it } from 'vitest'
import { createSearchStore } from './useSearchStore'
import { workspaceStorageKey } from '@/stores/workspacePersistence'

beforeEach(() => localStorage.clear())

describe('workspace search mode persistence #1277', () => {
  it('restores the selected mode and query for its workspace without storing search results', () => {
    createSearchStore('/files').getState().setSearchState({
      searchMode: 'filename', searchKeyword: 'notes', hasSearched: true,
    })
    expect(createSearchStore('/files').getState()).toMatchObject({
      searchMode: 'filename', searchKeyword: 'notes', hasSearched: true, resultList: [],
    })
    expect(createSearchStore('/contents').getState().searchMode).toBe('content')
  })

  it.each([undefined, 'invalid'])('keeps old or invalid saved modes on content search (%s)', (searchMode) => {
    localStorage.setItem(workspaceStorageKey('search', '/old'), JSON.stringify({
      version: 1, state: { searchMode, searchKeyword: 'old draft' },
    }))
    expect(createSearchStore('/old').getState()).toMatchObject({
      searchMode: 'content', searchKeyword: 'old draft',
    })
  })
})
