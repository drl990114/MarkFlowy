import { listen } from '@tauri-apps/api/event'
import { create } from 'zustand'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import {
  BOOKMARK_LIBRARY_CHANGED_EVENT,
  BookmarkError,
  normalizeBookmarkError,
  readBookmarkLibrary,
  writeBookmarkMutation,
} from './repository'
import type {
  Bookmark,
  BookmarkLibrary,
  BookmarkMigrationWarning,
  BookmarkMutation,
  PendingBookmarkRemoval,
} from './types'

export const BOOKMARK_UNDO_DURATION_MS = 5000

export interface BookmarkState {
  library: BookmarkLibrary
  loadStatus: 'idle' | 'loading' | 'ready' | 'error'
  loadError: string | null
  migrationWarning: BookmarkMigrationWarning | null
  pendingRemovals: Record<string, PendingBookmarkRemoval>
  mutationError: { bookmarkId: string; message: string } | null
  removeBookmark: (id: string) => Bookmark | undefined
  undoRemoveBookmark: (id: string) => boolean
  retryBookmarkRemoval: (id: string) => Promise<void>
  findBookmark: (path: string) => Bookmark | undefined
}

function getPendingRemoval(id: string): PendingBookmarkRemoval | undefined {
  const { pendingRemovals } = useBookmarkStore.getState()
  return Object.hasOwn(pendingRemovals, id) ? pendingRemovals[id] : undefined
}

function clearPendingRemoval(id: string) {
  const pending = getPendingRemoval(id)
  if (!pending) return
  if (pending.timeoutId !== undefined) clearTimeout(pending.timeoutId)
  useBookmarkStore.setState((state) => {
    const { [id]: _removed, ...pendingRemovals } = state.pendingRemovals
    return { pendingRemovals }
  })
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  library: { schemaVersion: 1, revision: 0, items: [] },
  loadStatus: 'idle',
  loadError: null,
  migrationWarning: null,
  pendingRemovals: {},
  mutationError: null,
  removeBookmark: (id) => {
    const pending = getPendingRemoval(id)
    if (pending) return pending.bookmark
    const { library } = get()
    const bookmark = library.items.find((item) => item.id === id)
    if (!bookmark) return undefined
    const timeoutId = setTimeout(() => {
      void commitBookmarkRemoval(id)
    }, BOOKMARK_UNDO_DURATION_MS)
    set((state) => ({
      mutationError: null,
      pendingRemovals: {
        ...state.pendingRemovals,
        [id]: { bookmark, expectedRevision: library.revision, phase: 'undoable', timeoutId },
      },
    }))
    return bookmark
  },
  undoRemoveBookmark: (id) => {
    if (getPendingRemoval(id)?.phase !== 'undoable') return false
    clearPendingRemoval(id)
    return true
  },
  retryBookmarkRemoval: async (id) => {
    const { library, mutationError } = get()
    if (mutationError?.bookmarkId !== id || getPendingRemoval(id)) return
    const bookmark = library.items.find((item) => item.id === id)
    if (!bookmark) {
      set({ mutationError: null })
      return
    }
    set((state) => ({
      mutationError: null,
      pendingRemovals: {
        ...state.pendingRemovals,
        [id]: { bookmark, expectedRevision: library.revision, phase: 'undoable' },
      },
    }))
    await commitBookmarkRemoval(id)
  },
  findBookmark: (path) => {
    const identity = getPathIdentityKey(path)
    const { library, pendingRemovals } = get()
    return library.items.find(
      (item) =>
        !Object.hasOwn(pendingRemovals, item.id) &&
        getPathIdentityKey(item.target.path) === identity,
    )
  },
}))

function publish(library: BookmarkLibrary, warning?: BookmarkMigrationWarning | null) {
  const state = useBookmarkStore.getState()
  if (library.revision < state.library.revision) return
  const existingIds = new Set(library.items.map((item) => item.id))
  const pendingRemovals = Object.fromEntries(
    Object.entries(state.pendingRemovals).filter(([id, pending]) => {
      if (existingIds.has(id)) return true
      if (pending.timeoutId !== undefined) clearTimeout(pending.timeoutId)
      return false
    }),
  )
  useBookmarkStore.setState({
    library,
    loadStatus: 'ready',
    loadError: null,
    pendingRemovals,
    mutationError:
      state.mutationError && existingIds.has(state.mutationError.bookmarkId)
        ? state.mutationError
        : null,
    ...(warning !== undefined ? { migrationWarning: warning } : {}),
  })
}

let loadSequence = 0
let committedWrites = 0
let listenerGeneration = 0
let activeLoad: Promise<void> = Promise.resolve()

async function readAndPublishBookmarkLibrary(sequence: number, generation: number): Promise<void> {
  const writesAtStart = committedWrites
  useBookmarkStore.setState((state) => ({
    loadError: null,
    loadStatus: state.loadStatus === 'ready' ? 'ready' : 'loading',
  }))
  try {
    const { library, warning } = await readBookmarkLibrary()
    if (generation === listenerGeneration && sequence === loadSequence) publish(library, warning)
  } catch (error) {
    if (
      generation === listenerGeneration &&
      sequence === loadSequence &&
      writesAtStart === committedWrites
    ) {
      useBookmarkStore.setState({
        loadError: normalizeBookmarkError(error).message,
        loadStatus: 'error',
      })
    }
  }
}

export async function loadBookmarkLibrary(): Promise<void> {
  const generation = listenerGeneration
  let pending = readAndPublishBookmarkLibrary(++loadSequence, generation)
  activeLoad = pending
  // The caller needs the current read to settle, even if a subscription refresh
  // supersedes its own request. Only track raw reads here; wrappers must never
  // wait on each other.
  while (true) {
    await pending
    if (generation !== listenerGeneration || pending === activeLoad) return
    pending = activeLoad
  }
}

export async function mutateBookmark(
  mutation: BookmarkMutation,
  expectedRevision: number,
): Promise<BookmarkLibrary> {
  try {
    const library = await writeBookmarkMutation(mutation, expectedRevision)
    ++committedWrites
    publish(library)
    return library
  } catch (error) {
    const bookmarkError = normalizeBookmarkError(error)
    // Refresh authority, leaving the caller's draft and revision untouched.
    if (bookmarkError.code === 'conflict') await loadBookmarkLibrary()
    throw bookmarkError
  }
}

function isUnchangedBookmark(left: Bookmark, right: Bookmark): boolean {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.createdAt === right.createdAt &&
    left.target.kind === right.target.kind &&
    left.target.path === right.target.path &&
    left.tags.length === right.tags.length &&
    left.tags.every((tag, index) => tag === right.tags[index])
  )
}

let removalQueue: Promise<void> = Promise.resolve()

function commitBookmarkRemoval(id: string): Promise<void> {
  const pending = getPendingRemoval(id)
  if (!pending || pending.phase === 'committing') return Promise.resolve()
  if (pending.timeoutId !== undefined) clearTimeout(pending.timeoutId)
  const committing: PendingBookmarkRemoval = { ...pending, phase: 'committing' }
  useBookmarkStore.setState((state) => ({
    pendingRemovals: { ...state.pendingRemovals, [id]: committing },
  }))
  // Consecutive local deletions share one queue so each sees the previous committed revision.
  removalQueue = removalQueue.then(async () => {
    if (getPendingRemoval(id) !== committing) return
    const { library } = useBookmarkStore.getState()
    const current = library.items.find((item) => item.id === id)
    if (!current) {
      clearPendingRemoval(id)
      return
    }
    try {
      if (!isUnchangedBookmark(current, pending.bookmark)) {
        throw new BookmarkError('conflict', 'The bookmark changed before it could be removed.')
      }
      // A change to an unrelated item can safely advance this removal's revision. A real
      // repository conflict still refreshes and returns to the user without replaying.
      await mutateBookmark({ type: 'delete', id }, library.revision)
      clearPendingRemoval(id)
    } catch (error) {
      clearPendingRemoval(id)
      const stillExists = useBookmarkStore.getState().library.items.some((item) => item.id === id)
      useBookmarkStore.setState({
        mutationError: stillExists
          ? { bookmarkId: id, message: normalizeBookmarkError(error).message }
          : null,
      })
    }
  })
  return removalQueue
}

let subscribers = 0
let cleanup: (() => void) | undefined

/** Root owns the lifetime; additional consumers share the same native subscription. */
export function subscribeBookmarkLibrary(): () => void {
  subscribers += 1
  if (subscribers === 1) {
    const generation = ++listenerGeneration
    void listen(BOOKMARK_LIBRARY_CHANGED_EVENT, () => {
      if (generation === listenerGeneration && subscribers) void loadBookmarkLibrary()
    })
      .then((unlisten) => {
        if (generation !== listenerGeneration || !subscribers) {
          unlisten()
          return
        }
        cleanup = unlisten
        // Read only once listening, closing the initial read/subscription race.
        void loadBookmarkLibrary()
      })
      .catch(() => {
        if (generation === listenerGeneration && subscribers) void loadBookmarkLibrary()
      })
  }
  let released = false
  return () => {
    if (released) return
    released = true
    subscribers -= 1
    if (!subscribers) {
      ++listenerGeneration
      ++loadSequence
      cleanup?.()
      cleanup = undefined
    }
  }
}
