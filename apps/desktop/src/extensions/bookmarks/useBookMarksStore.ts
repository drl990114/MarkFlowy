import { getFileObjectByPath } from '@/helper/files'
import { createFile } from '@/helper/filesys'
import { useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { nanoid } from 'nanoid'
import { create } from 'zustand'

export const BOOKMARK_UNDO_DURATION_MS = 5000

export type BookMarkItem = {
  id: string
  title: string
  path: string
  tags: string[]
}

export type BookMarksLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

type RemovedBookMark = {
  bookmark: BookMarkItem
  index: number
}

type PendingBookMarkRemoval = RemovedBookMark & {
  phase: 'undoable' | 'committing'
  timeoutId?: ReturnType<typeof setTimeout>
}

type BookMarkMutationError = {
  bookmarkId: string
  message: string
}

function collectTags(bookmarks: BookMarkItem[]) {
  return [...new Set(bookmarks.flatMap((bookmark) => bookmark.tags))]
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function restoreRemovedBookMark(bookmarks: BookMarkItem[], removed: RemovedBookMark) {
  if (bookmarks.some((bookmark) => bookmark.id === removed.bookmark.id)) return bookmarks

  const nextBookmarks = [...bookmarks]
  nextBookmarks.splice(Math.min(removed.index, nextBookmarks.length), 0, removed.bookmark)
  return nextBookmarks
}

const useBookMarksStore = create<BookMarksStore>((set, get) => {
  const setBookMarks = (bookMarkList: BookMarkItem[]) => {
    set({ bookMarkList, tagList: collectTags(bookMarkList) })
  }

  const visibleServerBookmarks = (bookmarks: BookMarkItem[]) => {
    const pendingIds = new Set(Object.keys(get().pendingRemovals))
    return bookmarks.filter((bookmark) => !pendingIds.has(bookmark.id))
  }

  const commitBookMarkRemoval = async (id: string) => {
    const pendingRemoval = get().pendingRemovals[id]
    if (!pendingRemoval || pendingRemoval.phase === 'committing') return

    set((state) => {
      const current = state.pendingRemovals[id]
      if (!current) return state
      return {
        pendingRemovals: {
          ...state.pendingRemovals,
          [id]: { ...current, phase: 'committing' },
        },
      }
    })

    try {
      await invoke('remove_bookmark', { id })
      set((state) => {
        const { [id]: _committedRemoval, ...pendingRemovals } = state.pendingRemovals
        return { pendingRemovals }
      })
    } catch (error) {
      const failedRemoval: RemovedBookMark = {
        bookmark: pendingRemoval.bookmark,
        index: pendingRemoval.index,
      }
      const restoredBookmarks = restoreRemovedBookMark(get().bookMarkList, failedRemoval)
      set((state) => {
        const { [id]: _failedRemoval, ...pendingRemovals } = state.pendingRemovals
        return {
          bookMarkList: restoredBookmarks,
          failedRemoval,
          mutationError: {
            bookmarkId: id,
            message: errorMessage(error),
          },
          pendingRemovals,
          tagList: collectTags(restoredBookmarks),
        }
      })
    }
  }

  return {
    bookMarkList: [],
    failedRemoval: null,
    loadError: null,
    loadStatus: 'idle',
    mutationError: null,
    pendingRemovals: {},
    tagList: [],

    findMark: (path: string) => {
      return get().bookMarkList.find((item) => item.path === path)
    },

    setBookMarkList: (bookMarkList: BookMarkItem[]) => {
      setBookMarks(bookMarkList)
    },

    getBookMarkList: async () => {
      if (get().loadStatus === 'loading') return

      set({ loadError: null, loadStatus: 'loading' })
      try {
        const { bookmarks } = await invoke<{ bookmarks: BookMarkItem[] }>('get_bookmarks')
        setBookMarks(visibleServerBookmarks(bookmarks))
        set({ loadStatus: 'ready' })
      } catch (error) {
        set({ loadError: errorMessage(error), loadStatus: 'error' })
      }
    },

    addBookMark: async (bookMark: Omit<BookMarkItem, 'id'>) => {
      const { bookMarkList } = get()
      const existBookMark = bookMarkList.find((item) => item.path === bookMark.path)
      const targetBookMark: BookMarkItem = existBookMark
        ? {
            ...existBookMark,
            ...bookMark,
          }
        : {
            id: nanoid(),
            ...bookMark,
          }

      const { bookmarks } = await invoke<{ bookmarks: BookMarkItem[] }>(
        existBookMark ? 'edit_bookmark' : 'add_bookmark',
        { item: targetBookMark },
      )
      setBookMarks(visibleServerBookmarks(bookmarks))
      set({ loadError: null, loadStatus: 'ready' })
    },

    removeBookMark: (id: string) => {
      const { bookMarkList, pendingRemovals } = get()
      if (pendingRemovals[id]) return pendingRemovals[id].bookmark

      const index = bookMarkList.findIndex((bookmark) => bookmark.id === id)
      const bookmark = bookMarkList[index]
      if (!bookmark) return undefined

      const timeoutId = setTimeout(() => {
        void commitBookMarkRemoval(id)
      }, BOOKMARK_UNDO_DURATION_MS)
      const nextBookmarks = bookMarkList.filter((item) => item.id !== id)

      set({
        bookMarkList: nextBookmarks,
        failedRemoval: null,
        mutationError: null,
        pendingRemovals: {
          ...pendingRemovals,
          [id]: { bookmark, index, phase: 'undoable', timeoutId },
        },
        tagList: collectTags(nextBookmarks),
      })

      return bookmark
    },

    undoRemoveBookMark: (id: string) => {
      const pendingRemoval = get().pendingRemovals[id]
      if (!pendingRemoval || pendingRemoval.phase !== 'undoable') return false

      if (pendingRemoval.timeoutId) clearTimeout(pendingRemoval.timeoutId)
      set((state) => {
        const { [id]: _undoneRemoval, ...pendingRemovals } = state.pendingRemovals
        const bookMarkList = restoreRemovedBookMark(state.bookMarkList, pendingRemoval)
        return {
          bookMarkList,
          pendingRemovals,
          tagList: collectTags(bookMarkList),
        }
      })
      return true
    },

    retryBookMarkRemoval: async (id: string) => {
      const failedRemoval = get().failedRemoval
      if (!failedRemoval || failedRemoval.bookmark.id !== id) return

      const nextBookmarks = get().bookMarkList.filter((bookmark) => bookmark.id !== id)
      set((state) => {
        return {
          bookMarkList: nextBookmarks,
          failedRemoval: null,
          mutationError: null,
          pendingRemovals: {
            ...state.pendingRemovals,
            [id]: { ...failedRemoval, phase: 'committing' },
          },
          tagList: collectTags(nextBookmarks),
        }
      })

      try {
        await invoke('remove_bookmark', { id })
        set((state) => {
          const { [id]: _committedRemoval, ...pendingRemovals } = state.pendingRemovals
          return { pendingRemovals }
        })
      } catch (error) {
        const restoredBookmarks = restoreRemovedBookMark(get().bookMarkList, failedRemoval)
        set((state) => {
          const { [id]: _failedRemoval, ...pendingRemovals } = state.pendingRemovals
          return {
            bookMarkList: restoredBookmarks,
            failedRemoval,
            mutationError: {
              bookmarkId: id,
              message: errorMessage(error),
            },
            pendingRemovals,
            tagList: collectTags(restoredBookmarks),
          }
        })
      }
    },

    openBookMark: (bookmark: BookMarkItem) => {
      let file = getFileObjectByPath(bookmark.path)
      if (!file) {
        file = createFile({
          name: bookmark.title,
          path: bookmark.path,
        })
      }

      useEditorStore.getState().addOpenedFile(file.id)
      useEditorStore.getState().setActiveId(file.id)
    },
  }
})

interface BookMarksStore {
  bookMarkList: BookMarkItem[]
  failedRemoval: RemovedBookMark | null
  loadError: string | null
  loadStatus: BookMarksLoadStatus
  mutationError: BookMarkMutationError | null
  pendingRemovals: Record<string, PendingBookMarkRemoval>
  tagList: string[]
  findMark: (path: string) => BookMarkItem | undefined
  setBookMarkList: (bookMarkList: BookMarkItem[]) => void
  addBookMark: (bookMark: Omit<BookMarkItem, 'id'>) => Promise<void>
  removeBookMark: (id: string) => BookMarkItem | undefined
  undoRemoveBookMark: (id: string) => boolean
  retryBookMarkRemoval: (id: string) => Promise<void>
  getBookMarkList: () => Promise<void>
  openBookMark: (bookmark: BookMarkItem) => void
}

export default useBookMarksStore
