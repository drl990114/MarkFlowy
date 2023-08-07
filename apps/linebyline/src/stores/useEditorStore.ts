import { create } from 'zustand'
import { createFile, type IFile } from '@/helper/filesys'
import type { EditorDelegate } from '@linebyline/editor/types'

const useEditorStore = create<EditorStore>((set, get) => {
  return {
    opened: [],
    activeId: undefined,
    folderData: null,
    editorCtxMap: new Map(),

    addFile: () => {
      const untitledFile = createFile()
      const { activeId, folderData, setActiveId, addOpenedFile } = get()
      if (activeId && folderData )  {
        const dfs = (tree: IFile[]) => {
          for(let i = 0; i < tree.length; i++) {
            if (tree[i].id === activeId) {
              tree.splice(i+1, 0, untitledFile)
              set(state => {
                return {
                  ...state,
                  folderData: [
                    ...(state.folderData || []),
                  ]
                }
              })
              setActiveId(untitledFile.id)
              addOpenedFile(untitledFile.id)
              return
            } else if (tree[i]?.children) {
              dfs(tree[i].children!)
            }
          }
        }
        dfs(folderData)
        
      }  else {
        set(state => {
          return {
            ...state,
            folderData: [
              ...(state.folderData || []),
              untitledFile
            ]
          }
        })
        setActiveId(untitledFile.id)
        addOpenedFile(untitledFile.id)
      }
    },

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
  addFile: () => void
  addOpenedFile: (id: string) => void
  delOpenedFile: (id: string) => void
  setFolderData: (folderData: IFile[]) => void
  setEditorDelegate: (id: string, delegate: EditorDelegate<any>) => void
  getEditorContent: (id: string) => string
  getEditorDelegate: (id: string) => EditorDelegate<any> | undefined
}

export default useEditorStore
