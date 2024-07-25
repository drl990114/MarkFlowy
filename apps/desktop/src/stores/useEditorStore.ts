import { create } from 'zustand'
import { createFile, isMdFile, type IFile, getFolderPathFromPath } from '@/helper/filesys'
import type { EditorContext, EditorDelegate } from 'rme'
import { invoke } from '@tauri-apps/api/core'

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

const findParentNodeByPath = (path: string, rootFile: IFile) => {
  const folderPath = getFolderPathFromPath(path)

  if (rootFile.path === folderPath) return rootFile

  const dfs = (file: IFile): undefined | IFile => {
    if (!file.children) return undefined

    for (let i = 0; i < file.children.length; i++) {
      if (file.children[i].path === folderPath) {
        return file.children[i]
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

type BaseIFile = { name: string; kind: IFile['kind'] }

function isSameFile(current: BaseIFile, target: BaseIFile): boolean {
  return current.name === target.name && current.kind === target.kind
}

const hasSameFile = (fileNodeList: IFile[], target: BaseIFile) => {
  return !!fileNodeList.find((file) => isSameFile(file, target))
}

const useEditorStore = create<EditorStore>((set, get) => {
  return {
    opened: [],
    activeId: undefined,
    folderData: null,
    editorDelegateMap: new Map(),
    editorCtxMap: new Map(),

    addFile: async (fileNode, target) => {
      const { folderData, addOpenedFile } = get()
      if (fileNode && target) {
        const parent = fileNode.kind === 'dir' ? fileNode : findParentNode(fileNode, folderData![0])

        if (!isMdFile(target.name)) {
          target.name = `${target.name}.md`
        }

        if (!parent || hasSameFile(parent.children!, target)) return

        const targetFile = createFile({
          path: parent.path ? `${parent.path}/${target.name}` : target.name,
          content: '',
          ...target,
        })

        parent.children!.push(targetFile)
        addOpenedFile(targetFile.id)
        await invoke('write_file', {
          filePath: targetFile.path,
          content: targetFile.content,
        })

        set((state) => {
          return {
            ...state,
            activeId: targetFile.id,
            // folderData: [...(state.folderData || [])],
          }
        })

        return targetFile
      }
    },

    insertNodeToFolderData: (fileNode) => {
      const { folderData } = get()
      if (fileNode) {
        const parent =
          fileNode.kind === 'dir' ? fileNode : findParentNodeByPath(fileNode.path!, folderData![0])

        if (!parent) return false
        let sameFile = parent.children?.find((file) => isSameFile(file, fileNode))
        if (sameFile) {
          sameFile = {
            ...sameFile,
            ...fileNode,
          }
        } else {
          parent.children!.push(fileNode)
        }

        set((state) => {
          return {
            ...state,
            opened: sameFile ? state.opened.filter((id) => id !== sameFile!.id) : state.opened,
            folderData: [...(state.folderData || [])],
          }
        })
      }
    },

    deleteNode: async (fileNode) => {
      const { folderData, activeId, delOpenedFile, opened } = get()
      const parent = findParentNode(fileNode, folderData![0])

      if (parent?.children) {
        await invoke(fileNode.kind === 'dir' ? 'delete_folder' : 'delete_file', {
          filePath: fileNode.path,
        })

        delOpenedFile(fileNode!.id)
        set((state) => {
          return {
            ...state,
            activeId: activeId === fileNode!.id ? opened[opened.length - 1] : activeId,
          }
        })
      }
    },

    trashNode: async (fileNode) => {
      const { folderData, activeId, delOpenedFile, opened } = get()
      const parent = findParentNode(fileNode, folderData![0])

      if (parent?.children) {
        await invoke('trash_delete', {
          path: fileNode.path,
        })

        delOpenedFile(fileNode!.id)
        set((state) => {
          return {
            ...state,
            activeId: activeId === fileNode!.id ? opened[opened.length - 1] : activeId,
          }
        })
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

    delOtherOpenedFile: (id: string) => {
      set((state) => {
        return {
          ...state,
          activeId: id,
          opened: [id],
        }
      })
    },

    delAllOpenedFile: () => {
      set((state) => {
        return {
          ...state,
          activeId: undefined,
          opened: [],
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
      const editorDelegateMap = get().editorDelegateMap
      const curCtx = editorDelegateMap.get(id)

      return curCtx
    },

    setEditorDelegate: (id, delegate) =>
      set((state) => {
        state.editorDelegateMap.set(id, delegate)
        return state
      }),

    setFolderData: (folderData) =>
      set((state) => ({
        ...state,
        folderData,
        opened: [],
        activeId: undefined,
      })),

    setFolderDataPure: (folderData) =>
      set((state) => ({
        ...state,
        folderData,
      })),

    setEditorCtx: (id, ctx) =>
      set((state) => {
        state.editorCtxMap.set(id, ctx)
        return {
          ...state,
          editorCtxMap: new Map(state.editorCtxMap),
        }
      }),

    getEditorCtx: (id) => {
      const editorCtxMap = get().editorCtxMap
      const curCtx = editorCtxMap.get(id)

      return curCtx
    },
  }
})

type EditorStore = {
  opened: string[]
  activeId?: string
  /**
   * folderData only has root file.
   */
  folderData: null | IFile[]
  editorCtxMap: Map<string, EditorContext>
  editorDelegateMap: Map<string, EditorDelegate<any>>
  setActiveId: (id: string) => void
  addFile: (file: IFile, target: BaseIFile) => Promise<void | IFile>
  insertNodeToFolderData: (fileNode: IFile) => void
  deleteNode: (fileNode: IFile) => Promise<void>
  trashNode: (fileNode: IFile) => Promise<void>
  addOpenedFile: (id: string) => void
  delOpenedFile: (id: string) => void
  delOtherOpenedFile: (id: string) => void
  delAllOpenedFile: () => void
  setFolderData: (folderData: IFile[]) => void
  /**
   * dont change opened and activeId
   * @param folderData
   * @returns
   */
  setFolderDataPure: (folderData: IFile[]) => void
  setEditorDelegate: (id: string, delegate: EditorDelegate<any>) => void
  getEditorContent: (id: string) => string
  getEditorDelegate: (id: string) => EditorDelegate<any> | undefined
  setEditorCtx: (id: string, ctx: EditorContext) => void
  getEditorCtx: (id: string) => EditorContext | undefined
}

export default useEditorStore
