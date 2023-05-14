import { CacheManager, isArray } from '@/utils'
import { IFile, createWelcomeFile } from '@/utils/filesys'
import { ReactFrameworkOutput, ReactExtensions } from '@remirror/react'
import { create } from 'zustand'

const useEditorStore = create<EditorStore>((set, get) => {
  // TODO use open history
  const welcomeFile = createWelcomeFile()

  return {
    opened: [welcomeFile.id],
    activeId: welcomeFile.id,
    folderData: [welcomeFile],
    editorCtxMap: new Map(),

    setActiveId: (id: string) => {
      set((state) => ({
        ...state,
        activeId: id,
      }))
    },

    addOpenedFile: (id: string) => {
      set((state) => {
        if (state.opened.includes(id)) {
          return state
        } else {
          return { ...state, opened: [...state.opened, id] }
        }
      })
    },

    delOpenedFile: (id: string) => {
      set((state) => {
        return { ...state, opened: state.opened.filter((opened) => opened !== id) }
      })
    },

    setEditorContent: (id: string, content: string) =>
      set((state) => {
        const curEditorCtx = state.editorCtxMap?.get(id)
        curEditorCtx?.setContent(content)
        return state
      }),

    getEditorContent: (id: string) => {
      const editorCtxMap = get().editorCtxMap
      const curCtx = editorCtxMap.get(id)

      if (isArray(curCtx)) {
        return curCtx[0].helpers.getMarkdown()
      }
      return curCtx?.helpers.getMarkdown()
    },

    setEditorCtx: (id, ctx) =>
      set((state) => {
        state.editorCtxMap.set(id, ctx)
        return state
      }),

    setFolderData: (folderData) => set((state) => ({ ...state, folderData, opened: [], activeId: undefined })),
  }
})

interface EditorStore {
  opened: string[]
  activeId?: string
  folderData: null | IFile[]
  editorCtxMap: Map<string, Ctx>
  setActiveId: (id: string) => void
  addOpenedFile: (id: string) => void
  delOpenedFile: (id: string) => void
  setFolderData: (folderData: IFile[]) => void
  setEditorCtx: (id: string, ctx: Ctx) => void
  getEditorContent: (id: string) => string
}

type Ctx =
  | ({
      setContent: (content: string) => void
      helpers: {
        setContent: (id: string, content: string) => void
        getMarkdown: () => string
        [key: string]: any
      }
      [key: string]: any
    } & ReactFrameworkOutput<ReactExtensions<any>>)
  | any

export default useEditorStore
