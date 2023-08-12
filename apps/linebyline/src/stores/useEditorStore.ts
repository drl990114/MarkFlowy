import { create } from 'zustand'
import { createFile, isMdFile, type IFile } from '@/helper/filesys'
import type { EditorDelegate } from '@linebyline/editor/types'
import { invoke } from '@tauri-apps/api'

const findParentNode = (fileNode: IFile, rootFile: IFile) => {
  const dfs = (file: IFile): undefined | IFile => {
    if (!file.children) return undefined

    for (let i = 0; i < file.children.length; i++) {
      if (file.children[i].id === fileNode.id) {
        return file
      } else if (file.children[i]) {
        const res = dfs(file.children[i])
        if (res) {
          return res
        }
      }
    }
  }

  return dfs(rootFile)
}

const hasSameFile = (fileNodeList: IFile[], target: { name: string; kind: IFile['kind'] }) => {
  return !!fileNodeList.find((file) => file.name === target.name && file.kind === target.kind)
}

const useEditorStore = create<EditorStore>((set, get) => {
  return {
    opened: [],
    activeId: undefined,
    folderData: null,
    editorCtxMap: new Map(),

    addFile: (fileNode, target) => {
      const { folderData, addOpenedFile } = get()
      if (fileNode && target) {
        const parent = fileNode.kind === 'dir' ? fileNode : findParentNode(fileNode, folderData![0])

        if (!isMdFile(target.name)) {
          target.name = `${target.name}.md`
        }

        if (!parent || hasSameFile(parent.children!, target)) return false

        const targetFile = createFile({
          name: target.name,
          path: parent.path ? `${parent.path}/${target.name}` : target.name,
          content: '',
        })

        parent.children!.push(targetFile)
        addOpenedFile(targetFile.id)
        set((state) => {
          return {
            ...state,
            activeId: targetFile.id,
            folderData: [...(state.folderData || [])],
          }
        })
        invoke('write_file', { filePath: targetFile.path, content: targetFile.content })
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
  addFile: (file: IFile, target: { name: string; kind: IFile['kind'] }) => boolean | void
  addOpenedFile: (id: string) => void
  delOpenedFile: (id: string) => void
  setFolderData: (folderData: IFile[]) => void
  setEditorDelegate: (id: string, delegate: EditorDelegate<any>) => void
  getEditorContent: (id: string) => string
  getEditorDelegate: (id: string) => EditorDelegate<any> | undefined
}

export default useEditorStore
