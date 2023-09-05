import { getFileObjectByPath } from '@/helper/files'
import { createFile } from '@/helper/filesys'
import { useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api'
import { nanoid } from 'nanoid'
import { create } from 'zustand'

const useBookMarksStore = create<BookMarksStore>((set, get) => ({
  bookMarkList: [],
  tagList: [],

  findMark: (path: string) => {
    return get().bookMarkList.find((item) => item.path === path)
  },

  setBookMarkList: (bookMarkList: BookMarkItem[]) => {
    set({ bookMarkList })
  },

  getBookMarkList: () => {
    invoke<{ bookmarks: BookMarkItem[] }>('get_bookmarks').then(({ bookmarks }) => {
      const curTagList = [...get().tagList]
      bookmarks.forEach((item) => {
        item.tags.forEach((tag) => {
          if (!curTagList.includes(tag)) {
            curTagList.push(tag)
          }
        })
      })
      set({ bookMarkList: bookmarks, tagList: curTagList })
    })
  },

  addBookMark: (bookMark: Omit<BookMarkItem, 'id'>) => {
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
    invoke<{ bookmarks: BookMarkItem[] }>(existBookMark ? 'edit_bookmark' : 'add_bookmark', { item: targetBookMark }).then(
      ({ bookmarks }) => {
        targetBookMark.tags.map((tag) => {
          if (!get().tagList.includes(tag)) {
            if (existBookMark) {
              set({ tagList: [...get().tagList] })
            } else {
              set({ tagList: [...get().tagList, tag] })
            }
          }
        })
        set({ bookMarkList: bookmarks })
      },
    )
  },

  removeBookMark: (id: string) => {
    const { bookMarkList } = get()
    invoke('remove_bookmark', { id }).then(() => {
      set({ bookMarkList: bookMarkList.filter((item) => item.id !== id) })
    })
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
}))

export type BookMarkItem = {
  id: string
  title: string
  path: string
  tags: string[]
}

interface BookMarksStore {
  bookMarkList: BookMarkItem[]
  tagList: string[]
  findMark: (path: string) => BookMarkItem | undefined
  setBookMarkList: (bookMarkList: BookMarkItem[]) => void
  addBookMark: (bookMark: Omit<BookMarkItem, 'id'>) => void
  removeBookMark: (id: string) => void
  getBookMarkList: () => void
  openBookMark: (bookmark: BookMarkItem) => void
}

export default useBookMarksStore
