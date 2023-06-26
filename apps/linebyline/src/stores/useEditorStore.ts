import { create } from 'zustand'
import type { IFile } from '@/helper/filesys'
import { createWelcomeFile } from '@/helper/filesys'
import type { EditorDelegate } from '@linebyline/editor/types'

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
        if (state.opened.includes(id)) return state
        else return { ...state, opened: [...state.opened, id] }
      })
    },

    delOpenedFile: (id: string) => {
      set((state) => {
        return {
          ...state,
          opened: state.opened.filter((opened) => opened !== id),
        }
      })
    },

    getEditorContent: (id: string) => {
      const curDelegate = get().getEditorDelegate(id)
      if (!curDelegate) {
        return ''
      } else {
        // @ts-ignore
        return curDelegate.docToString(curDelegate.manager.getState()?.doc)
      }
    },

    getEditorDelegate: (id: string) => {
      const editorCtxMap = get().editorCtxMap
      const curCtx = editorCtxMap.get(id)

      return curCtx
    },

    setEditorDelegate: (id, delegate) =>
      set((state) => {
        state.editorCtxMap.set(id, delegate)
        return state
      }),

    setFolderData: (folderData) =>
      set((state) => ({
        ...state,
        folderData,
        opened: [],
        activeId: undefined,
      })),
  }
})

interface EditorStore {
  opened: string[]
  activeId?: string
  folderData: null | IFile[]
  editorCtxMap: Map<string, EditorDelegate<any>>
  setActiveId: (id: string) => void
  addOpenedFile: (id: string) => void
  delOpenedFile: (id: string) => void
  setFolderData: (folderData: IFile[]) => void
  setEditorDelegate: (id: string, delegate: EditorDelegate<any>) => void
  getEditorContent: (id: string) => string
  getEditorDelegate: (id: string) => EditorDelegate<any> | undefined
}

export default useEditorStore
