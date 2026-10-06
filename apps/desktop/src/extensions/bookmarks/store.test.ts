import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BOOKMARK_UNDO_DURATION_MS,
  loadBookmarkLibrary,
  mutateBookmark,
  subscribeBookmarkLibrary,
  useBookmarkStore,
} from './store'
import { selectVisibleBookmarks } from './query'
import type { Bookmark, BookmarkLibrary, BookmarkLibraryResult } from './types'

const native = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn(), unlisten: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: native.listen }))

const first: Bookmark = {
  id: 'first',
  title: 'First',
  target: { kind: 'localFile', path: '/notes/first.md' },
  tags: ['work'],
  createdAt: 1,
}
const second: Bookmark = {
  ...first,
  id: 'second',
  target: { kind: 'localFile', path: '/notes/second.md' },
}
const library = (revision = 0, items: Bookmark[] = []): BookmarkLibrary => ({
  schemaVersion: 1,
  revision,
  items,
})
const result = (revision = 0, items: Bookmark[] = []): BookmarkLibraryResult => ({
  library: library(revision, items),
  warning: null,
})
const visible = () => {
  const state = useBookmarkStore.getState()
  return selectVisibleBookmarks(state.library.items, state.pendingRemovals)
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
async function settle() {
  for (let step = 0; step < 10; step += 1) await Promise.resolve()
}

const subscriptions: (() => void)[] = []
beforeEach(() => {
  vi.useFakeTimers()
  native.invoke.mockReset()
  native.listen.mockReset().mockResolvedValue(native.unlisten)
  native.unlisten.mockReset()
  useBookmarkStore.setState({
    library: library(),
    loadStatus: 'idle',
    loadError: null,
    migrationWarning: null,
    mutationError: null,
    pendingRemovals: {},
  })
})
afterEach(() => {
  subscriptions.splice(0).forEach((release) => release())
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('bookmark repository state', () => {
  it('loads the library with a retryable migration warning and preserves data on errors', async () => {
    const read = deferred<BookmarkLibraryResult>()
    native.invoke.mockReturnValueOnce(read.promise)
    const request = loadBookmarkLibrary()
    expect(useBookmarkStore.getState().loadStatus).toBe('loading')
    read.resolve({
      ...result(1, [first]),
      warning: { code: 'cleanupFailed', message: 'File locked' },
    })
    await request
    expect(useBookmarkStore.getState()).toMatchObject({
      library: library(1, [first]),
      loadStatus: 'ready',
      loadError: null,
      migrationWarning: { code: 'cleanupFailed', message: 'File locked' },
    })
    native.invoke.mockRejectedValueOnce({ code: 'invalid', message: 'Invalid library' })
    await loadBookmarkLibrary()
    expect(useBookmarkStore.getState()).toMatchObject({
      library: library(1, [first]),
      loadStatus: 'error',
      loadError: 'Invalid library',
    })
    native.invoke.mockResolvedValueOnce(result(1, [first]))
    await loadBookmarkLibrary()
    expect(useBookmarkStore.getState().migrationWarning).toBeNull()
  })

  it('publishes only committed mutations and returns structured failures', async () => {
    useBookmarkStore.setState({ library: library(1, [first]), loadStatus: 'ready' })
    const write = deferred<BookmarkLibrary>()
    native.invoke.mockReturnValueOnce(write.promise)
    const request = mutateBookmark({ type: 'delete', id: first.id }, 1)
    expect(useBookmarkStore.getState().library.items).toEqual([first])
    write.resolve(library(2))
    await request
    expect(useBookmarkStore.getState().library).toEqual(library(2))
    native.invoke.mockRejectedValueOnce({ code: 'io', message: 'Disk full' })
    await expect(mutateBookmark({ type: 'delete', id: second.id }, 2)).rejects.toMatchObject({
      code: 'io',
      message: 'Disk full',
    })
    expect(useBookmarkStore.getState().library).toEqual(library(2))
  })

  it.each(['success', 'failure'] as const)(
    'keeps a superseded load pending until the current read settles with %s',
    async (outcome) => {
      const oldRead = deferred<BookmarkLibraryResult>()
      const currentRead = deferred<BookmarkLibraryResult>()
      native.invoke.mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(currentRead.promise)
      let firstSettled = false
      const firstLoad = loadBookmarkLibrary().then(() => {
        firstSettled = true
      })
      const currentLoad = loadBookmarkLibrary()

      oldRead.resolve(result(1, [first]))
      await settle()
      expect(firstSettled).toBe(false)
      expect(useBookmarkStore.getState()).toMatchObject({ loadStatus: 'loading', loadError: null })

      if (outcome === 'success') currentRead.resolve(result(2, [first, second]))
      else currentRead.reject({ code: 'io', message: 'Current read failed' })
      await Promise.all([firstLoad, currentLoad])
      expect(firstSettled).toBe(true)
      expect(useBookmarkStore.getState()).toMatchObject(
        outcome === 'success'
          ? { library: library(2, [first, second]), loadStatus: 'ready', loadError: null }
          : { library: library(), loadStatus: 'error', loadError: 'Current read failed' },
      )
    },
  )

  it('follows repeated read supersession without waiting on another load wrapper', async () => {
    const reads = [
      deferred<BookmarkLibraryResult>(),
      deferred<BookmarkLibraryResult>(),
      deferred<BookmarkLibraryResult>(),
    ]
    for (const read of reads) native.invoke.mockReturnValueOnce(read.promise)
    let firstSettled = false
    const firstLoad = loadBookmarkLibrary().then(() => {
      firstSettled = true
    })
    const secondLoad = loadBookmarkLibrary()
    reads[0].resolve(result(1, [first]))
    await settle()
    const lastLoad = loadBookmarkLibrary()
    reads[1].resolve(result(2, [first]))
    await settle()
    expect(firstSettled).toBe(false)
    reads[2].resolve(result(3, [second]))
    await Promise.all([firstLoad, secondLoad, lastLoad])
    expect(useBookmarkStore.getState()).toMatchObject({
      library: library(3, [second]),
      loadStatus: 'ready',
    })
  })

  it('ignores stale reads, stale mutation replies and stale errors after a committed write', async () => {
    const oldRead = deferred<BookmarkLibraryResult>()
    native.invoke.mockReturnValueOnce(oldRead.promise)
    const oldRequest = loadBookmarkLibrary()
    const write = deferred<BookmarkLibrary>()
    native.invoke.mockReturnValueOnce(write.promise)
    const mutation = mutateBookmark({ type: 'delete', id: first.id }, 1)
    native.invoke.mockResolvedValueOnce(result(4, [second]))
    await loadBookmarkLibrary()
    write.resolve(library(2))
    await mutation
    oldRead.resolve(result(1, [first]))
    await oldRequest
    expect(useBookmarkStore.getState().library).toEqual(library(4, [second]))

    const failingRead = deferred<BookmarkLibraryResult>()
    native.invoke.mockReturnValueOnce(failingRead.promise)
    const failure = loadBookmarkLibrary()
    native.invoke.mockResolvedValueOnce(library(5))
    await mutateBookmark({ type: 'delete', id: second.id }, 4)
    failingRead.reject(new Error('old read failed'))
    await failure
    expect(useBookmarkStore.getState()).toMatchObject({
      library: library(5),
      loadError: null,
      loadStatus: 'ready',
    })
  })

  it('accepts a newer broadcast read that began before the mutation response', async () => {
    const write = deferred<BookmarkLibrary>()
    const read = deferred<BookmarkLibraryResult>()
    native.invoke.mockReturnValueOnce(write.promise).mockReturnValueOnce(read.promise)
    const mutation = mutateBookmark({ type: 'delete', id: first.id }, 1)
    const refresh = loadBookmarkLibrary()
    write.resolve(library(2))
    await mutation
    read.resolve(result(3, [second]))
    await refresh
    expect(useBookmarkStore.getState().library).toEqual(library(3, [second]))
  })

  it('refreshes a CAS conflict without rebasing or replaying the stale draft', async () => {
    native.invoke
      .mockRejectedValueOnce({ code: 'conflict', message: 'Changed elsewhere' })
      .mockResolvedValueOnce(result(7, [first]))
    const mutation = {
      type: 'update' as const,
      id: first.id,
      changes: { title: 'Draft', tags: [] },
    }
    await expect(mutateBookmark(mutation, 3)).rejects.toMatchObject({ code: 'conflict' })
    expect(native.invoke.mock.calls).toEqual([
      ['mutate_bookmark_library', { expectedRevision: 3, mutation }],
      ['get_bookmark_library'],
    ])
    expect(mutation.changes.title).toBe('Draft')
    expect(useBookmarkStore.getState().library).toEqual(library(7, [first]))
  })

  it('shares a subscription, listens before reading, and releases it once', async () => {
    const listening = deferred<() => void>()
    native.listen.mockReturnValueOnce(listening.promise)
    native.invoke.mockResolvedValue(result(1, [first]))
    const firstRelease = subscribeBookmarkLibrary()
    const lastRelease = subscribeBookmarkLibrary()
    subscriptions.push(firstRelease, lastRelease)
    expect(native.listen).toHaveBeenCalledTimes(1)
    expect(native.listen).toHaveBeenCalledWith('bookmark-library-changed', expect.any(Function))
    expect(native.invoke).not.toHaveBeenCalled()
    listening.resolve(native.unlisten)
    await settle()
    expect(useBookmarkStore.getState().library.revision).toBe(1)
    firstRelease()
    firstRelease()
    expect(native.unlisten).not.toHaveBeenCalled()
    native.invoke.mockResolvedValueOnce(result(2, [first, second]))
    native.listen.mock.calls[0][1]({ payload: 2 })
    await settle()
    expect(useBookmarkStore.getState().library.revision).toBe(2)
    lastRelease()
    expect(native.unlisten).toHaveBeenCalledTimes(1)
  })

  it('cleans up listeners resolving after unmount and ignores retired callbacks and reads', async () => {
    const listening = deferred<() => void>()
    native.listen.mockReturnValueOnce(listening.promise)
    const releaseOld = subscribeBookmarkLibrary()
    releaseOld()
    listening.resolve(native.unlisten)
    await settle()
    expect(native.unlisten).toHaveBeenCalledTimes(1)
    native.listen.mock.calls[0][1]({ payload: 1 })
    expect(native.invoke).not.toHaveBeenCalled()

    const read = deferred<BookmarkLibraryResult>()
    native.invoke.mockReturnValueOnce(read.promise)
    const release = subscribeBookmarkLibrary()
    await settle()
    release()
    read.resolve(result(8, [first]))
    await settle()
    expect(useBookmarkStore.getState().library.revision).toBe(0)
  })
})

describe('undoable bookmark deletion', () => {
  beforeEach(() =>
    useBookmarkStore.setState({ library: library(1, [first, second]), loadStatus: 'ready' }),
  )

  it('keeps authority unchanged and cancels only the overlay during the undo window', async () => {
    expect(useBookmarkStore.getState().removeBookmark(first.id)).toEqual(first)
    expect(visible()).toEqual([second])
    expect(useBookmarkStore.getState().library.items).toEqual([first, second])
    expect(useBookmarkStore.getState().findBookmark(first.target.path)).toBeUndefined()
    await vi.advanceTimersByTimeAsync(BOOKMARK_UNDO_DURATION_MS - 1)
    expect(useBookmarkStore.getState().undoRemoveBookmark(first.id)).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(visible()).toEqual([first, second])
    expect(native.invoke).not.toHaveBeenCalled()
  })

  it('never resurrects a bookmark deleted in another window when undo is clicked', async () => {
    useBookmarkStore.getState().removeBookmark(first.id)
    native.invoke.mockResolvedValueOnce(result(2, [second]))
    await loadBookmarkLibrary()
    expect(useBookmarkStore.getState().undoRemoveBookmark(first.id)).toBe(false)
    expect(visible()).toEqual([second])
    await vi.advanceTimersByTimeAsync(BOOKMARK_UNDO_DURATION_MS)
    expect(native.invoke).toHaveBeenCalledTimes(1)
  })

  it('holds the overlay through an in-flight commit and rejects undo after its deadline', async () => {
    const write = deferred<BookmarkLibrary>()
    native.invoke.mockReturnValueOnce(write.promise)
    useBookmarkStore.getState().removeBookmark(first.id)
    await vi.advanceTimersByTimeAsync(BOOKMARK_UNDO_DURATION_MS)
    expect(useBookmarkStore.getState().pendingRemovals[first.id].phase).toBe('committing')
    expect(useBookmarkStore.getState().undoRemoveBookmark(first.id)).toBe(false)
    native.invoke.mockResolvedValueOnce(result(1, [first, second]))
    await loadBookmarkLibrary()
    expect(visible()).toEqual([second])
    write.resolve(library(2, [second]))
    await settle()
    expect(useBookmarkStore.getState().pendingRemovals).toEqual({})
    expect(useBookmarkStore.getState().library.items).toEqual([second])
  })

  it('serializes two consecutive local removals using each committed revision', async () => {
    native.invoke.mockResolvedValueOnce(library(2, [second])).mockResolvedValueOnce(library(3))
    useBookmarkStore.getState().removeBookmark(first.id)
    useBookmarkStore.getState().removeBookmark(second.id)
    await vi.advanceTimersByTimeAsync(BOOKMARK_UNDO_DURATION_MS)
    expect(native.invoke.mock.calls).toEqual([
      [
        'mutate_bookmark_library',
        { expectedRevision: 1, mutation: { type: 'delete', id: first.id } },
      ],
      [
        'mutate_bookmark_library',
        { expectedRevision: 2, mutation: { type: 'delete', id: second.id } },
      ],
    ])
    expect(useBookmarkStore.getState()).toMatchObject({
      library: library(3),
      mutationError: null,
      pendingRemovals: {},
    })
  })

  it('cancels deletion if the target changed during its undo window', async () => {
    useBookmarkStore.getState().removeBookmark(first.id)
    const edited = { ...first, title: 'New title' }
    native.invoke.mockResolvedValueOnce(result(2, [edited, second]))
    await loadBookmarkLibrary()
    await vi.advanceTimersByTimeAsync(BOOKMARK_UNDO_DURATION_MS)
    expect(native.invoke).toHaveBeenCalledTimes(1)
    expect(visible()).toEqual([edited, second])
    expect(useBookmarkStore.getState().mutationError?.bookmarkId).toBe(first.id)
  })

  it('refreshes a server conflict and clears the overlay without restoring the old item', async () => {
    native.invoke
      .mockRejectedValueOnce({ code: 'conflict', message: 'Changed elsewhere' })
      .mockResolvedValueOnce(result(3, [second]))
    useBookmarkStore.getState().removeBookmark(first.id)
    await vi.advanceTimersByTimeAsync(BOOKMARK_UNDO_DURATION_MS)
    expect(visible()).toEqual([second])
    expect(useBookmarkStore.getState().pendingRemovals).toEqual({})
    expect(useBookmarkStore.getState().mutationError).toBeNull()
    expect(native.invoke).toHaveBeenCalledTimes(2)
    await useBookmarkStore.getState().retryBookmarkRemoval(first.id)
    expect(native.invoke).toHaveBeenCalledTimes(2)
  })

  it('reveals authority on a write failure and retries only after the user requests it', async () => {
    native.invoke
      .mockRejectedValueOnce({ code: 'io', message: 'Permission denied' })
      .mockResolvedValueOnce(library(2, [second]))
    useBookmarkStore.getState().removeBookmark(first.id)
    await vi.advanceTimersByTimeAsync(BOOKMARK_UNDO_DURATION_MS)
    expect(visible()).toEqual([first, second])
    expect(useBookmarkStore.getState().mutationError).toEqual({
      bookmarkId: first.id,
      message: 'Permission denied',
    })
    await useBookmarkStore.getState().retryBookmarkRemoval(first.id)
    expect(visible()).toEqual([second])
    expect(useBookmarkStore.getState().mutationError).toBeNull()
  })

  it('matches Windows path aliases while preserving POSIX case distinctions', () => {
    const windows = {
      ...second,
      target: { kind: 'localFile' as const, path: 'C:\\Notes\\Second.md' },
    }
    useBookmarkStore.setState({ library: library(1, [first, windows]) })
    expect(useBookmarkStore.getState().findBookmark('c:/notes/second.md')).toEqual(windows)
    expect(useBookmarkStore.getState().findBookmark('/NOTES/first.md')).toBeUndefined()
  })
})
