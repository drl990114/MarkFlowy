import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/helper/files', () => ({ getFileObjectByPath: vi.fn() }))
vi.mock('@/helper/filesys', () => ({ createFile: vi.fn() }))
vi.mock('@/stores', () => ({
  useEditorStore: {
    getState: () => ({
      addOpenedFile: vi.fn(),
      setActiveId: vi.fn(),
    }),
  },
}))

import useBookMarksStore, {
  BOOKMARK_UNDO_DURATION_MS,
  type BookMarkItem,
} from './useBookMarksStore'

const firstBookmark: BookMarkItem = {
  id: 'bookmark-1',
  path: '/workspace/first.md',
  tags: ['work'],
  title: 'First',
}

function resetStore() {
  Object.values(useBookMarksStore.getState().pendingRemovals).forEach(({ timeoutId }) => {
    if (timeoutId) clearTimeout(timeoutId)
  })
  useBookMarksStore.setState({
    bookMarkList: [],
    failedRemoval: null,
    loadError: null,
    loadStatus: 'idle',
    mutationError: null,
    pendingRemovals: {},
    tagList: [],
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  mocks.invoke.mockReset()
  resetStore()
})

afterEach(() => {
  resetStore()
  vi.useRealTimers()
})

describe('useBookMarksStore loading states', () => {
  it('exposes loading and ready states while bookmarks are fetched', async () => {
    let resolveRequest: ((value: { bookmarks: BookMarkItem[] }) => void) | undefined
    mocks.invoke.mockReturnValueOnce(
      new Promise<{ bookmarks: BookMarkItem[] }>((resolve) => {
        resolveRequest = resolve
      }),
    )

    const request = useBookMarksStore.getState().getBookMarkList()
    expect(useBookMarksStore.getState().loadStatus).toBe('loading')

    resolveRequest?.({ bookmarks: [firstBookmark] })
    await request

    expect(useBookMarksStore.getState()).toMatchObject({
      bookMarkList: [firstBookmark],
      loadError: null,
      loadStatus: 'ready',
      tagList: ['work'],
    })
  })

  it('exposes a retryable error and recovers on the next request', async () => {
    mocks.invoke
      .mockRejectedValueOnce(new Error('bookmarks.json is unavailable'))
      .mockResolvedValueOnce({ bookmarks: [firstBookmark] })

    await useBookMarksStore.getState().getBookMarkList()
    expect(useBookMarksStore.getState()).toMatchObject({
      loadError: 'bookmarks.json is unavailable',
      loadStatus: 'error',
    })

    await useBookMarksStore.getState().getBookMarkList()
    expect(useBookMarksStore.getState()).toMatchObject({
      bookMarkList: [firstBookmark],
      loadError: null,
      loadStatus: 'ready',
    })
  })
})

describe('useBookMarksStore undoable removal', () => {
  beforeEach(() => {
    useBookMarksStore.getState().setBookMarkList([firstBookmark])
    useBookMarksStore.setState({ loadStatus: 'ready' })
  })

  it('restores the bookmark without touching disk when undo runs within five seconds', async () => {
    useBookMarksStore.getState().removeBookMark(firstBookmark.id)
    expect(useBookMarksStore.getState().bookMarkList).toEqual([])

    await vi.advanceTimersByTimeAsync(BOOKMARK_UNDO_DURATION_MS - 1)
    expect(useBookMarksStore.getState().undoRemoveBookMark(firstBookmark.id)).toBe(true)
    await vi.advanceTimersByTimeAsync(1)

    expect(useBookMarksStore.getState().bookMarkList).toEqual([firstBookmark])
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('commits the removal after the undo window closes', async () => {
    mocks.invoke.mockResolvedValueOnce({ bookmarks: [] })

    useBookMarksStore.getState().removeBookMark(firstBookmark.id)
    await vi.advanceTimersByTimeAsync(BOOKMARK_UNDO_DURATION_MS)

    expect(mocks.invoke).toHaveBeenCalledWith('remove_bookmark', {
      id: firstBookmark.id,
    })
    expect(useBookMarksStore.getState().bookMarkList).toEqual([])
  })

  it('keeps a tombstone while the backend commit is pending so refresh cannot resurrect it', async () => {
    let resolveRemoval: (() => void) | undefined
    mocks.invoke.mockImplementation((command: string) => {
      if (command === 'remove_bookmark') {
        return new Promise<void>((resolve) => {
          resolveRemoval = resolve
        })
      }
      return Promise.resolve({ bookmarks: [firstBookmark] })
    })

    useBookMarksStore.getState().removeBookMark(firstBookmark.id)
    vi.advanceTimersByTime(BOOKMARK_UNDO_DURATION_MS)
    await Promise.resolve()

    expect(useBookMarksStore.getState().pendingRemovals[firstBookmark.id]?.phase).toBe(
      'committing',
    )
    await useBookMarksStore.getState().getBookMarkList()
    expect(useBookMarksStore.getState().bookMarkList).toEqual([])

    resolveRemoval?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(useBookMarksStore.getState().pendingRemovals).toEqual({})
    expect(useBookMarksStore.getState().bookMarkList).toEqual([])
  })

  it('restores a failed removal and supports retry', async () => {
    mocks.invoke
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValueOnce({ bookmarks: [] })

    useBookMarksStore.getState().removeBookMark(firstBookmark.id)
    await vi.advanceTimersByTimeAsync(BOOKMARK_UNDO_DURATION_MS)

    expect(useBookMarksStore.getState()).toMatchObject({
      bookMarkList: [firstBookmark],
      mutationError: {
        bookmarkId: firstBookmark.id,
        message: 'permission denied',
      },
    })

    await useBookMarksStore.getState().retryBookMarkRemoval(firstBookmark.id)
    expect(useBookMarksStore.getState()).toMatchObject({
      bookMarkList: [],
      failedRemoval: null,
      mutationError: null,
    })
    expect(mocks.invoke).toHaveBeenCalledTimes(2)
  })
})
