import { beforeEach, describe, expect, it } from 'vitest'
import { BOOKMARK_VIEW_STORAGE_KEY, useBookmarkViewStore } from './viewStore'

beforeEach(() => {
  localStorage.clear()
  useBookmarkViewStore.setState({
    config: { groupBy: 'none', sort: { field: 'title', direction: 'asc' } },
    expandedGroupIds: [],
  })
})

describe('bookmark view preferences', () => {
  it('defaults to a flat list sorted by ascending title', () => {
    expect(useBookmarkViewStore.getState().config).toEqual({
      groupBy: 'none',
      sort: { field: 'title', direction: 'asc' },
    })
  })

  it('persists and restores only view settings and group identities', async () => {
    const store = useBookmarkViewStore.getState()
    store.setGroupBy('tag')
    store.setSort({ field: 'createdAt', direction: 'desc' })
    store.toggleGroup('tag:work')
    store.toggleGroup('untagged')
    const saved = localStorage.getItem(BOOKMARK_VIEW_STORAGE_KEY)!
    expect(JSON.parse(saved).state).toEqual({
      config: { groupBy: 'tag', sort: { field: 'createdAt', direction: 'desc' } },
      expandedGroupIds: ['tag:work', 'untagged'],
    })
    useBookmarkViewStore.setState({
      config: { groupBy: 'none', sort: { field: 'title', direction: 'asc' } },
      expandedGroupIds: [],
    })
    localStorage.setItem(BOOKMARK_VIEW_STORAGE_KEY, saved)
    await useBookmarkViewStore.persist.rehydrate()
    expect(useBookmarkViewStore.getState()).toMatchObject(JSON.parse(saved).state)
    useBookmarkViewStore.getState().toggleGroup('tag:work')
    expect(useBookmarkViewStore.getState().expandedGroupIds).toEqual(['untagged'])
  })

  it('validates saved values and never restores obsolete bookmark view preferences', async () => {
    localStorage.setItem(
      'mf:desktop:bookmarks-view',
      JSON.stringify({
        state: { viewMode: 'tags', expandedTags: ['old'] },
        version: 1,
      }),
    )
    localStorage.removeItem(BOOKMARK_VIEW_STORAGE_KEY)
    await useBookmarkViewStore.persist.rehydrate()
    expect(useBookmarkViewStore.getState().config.groupBy).toBe('none')
    localStorage.setItem(
      BOOKMARK_VIEW_STORAGE_KEY,
      JSON.stringify({
        state: {
          config: { groupBy: 'unsupported', sort: { field: 'path', direction: 'reverse' } },
          expandedGroupIds: ['tag:work', 3, null, 'tag:work'],
        },
        version: 1,
      }),
    )
    await useBookmarkViewStore.persist.rehydrate()
    expect(useBookmarkViewStore.getState()).toMatchObject({
      config: { groupBy: 'none', sort: { field: 'title', direction: 'asc' } },
      expandedGroupIds: ['tag:work'],
    })
  })
})
