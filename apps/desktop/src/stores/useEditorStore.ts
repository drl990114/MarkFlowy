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
        invoke('write_file', { filePath: targetFile.path, content: targetFile.content }).then(
          () => {
            set((state) => {
              return {
                ...state,
                activeId: targetFile.id,
                folderData: [...(state.folderData || [])],
              }
            })
          },
        )
      }
    },

    insertNodeToFolderData: (fileNode) => {
      const { folderData } = get()
      if (fileNode) {
        const parent = fileNode.kind === 'dir' ? fileNode : findParentNodeByPath(fileNode.path!, folderData![0])

        if (!parent) return false
        let sameFile = parent.children?.find((file) => isSameFile(file, fileNode))
        if (sameFile) {
          sameFile = {
            ...sameFile,
            ...fileNode
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

    deleteNode: (fileNode) => {
      const { folderData, activeId, delOpenedFile, opened } = get()
      const parent = findParentNode(fileNode, folderData![0])
      let targetFile: IFile | undefined

      if (parent?.children) {
        const newChildren: IFile[] = []
        for (let i = 0; i < parent.children.length; i++) {
          const child = parent.children[i]
          if (isSameFile(child, fileNode)) {
            targetFile = child
          } else {
            newChildren.push(child)
          }
        }
        if (!targetFile) return false

        parent.children = newChildren

        invoke(targetFile.kind === 'dir' ? 'delete_folder' : 'delete_file', {
          filePath: targetFile.path,
        }).then(() => {
          delOpenedFile(targetFile!.id)
          set((state) => {
            return {
              ...state,
              activeId: activeId === targetFile!.id ? opened[opened.length - 1] : activeId,
              folderData: [...(state.folderData || [])],
            }
          })
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

    setEditorCtx: (id, ctx) =>
      set((state) => {
        state.editorCtxMap.set(id, ctx)
        return {
          ...state,
          editorCtxMap: new Map(state.editorCtxMap),
        }
      }
    ),

    getEditorCtx: (id) => {
      const editorCtxMap = get().editorCtxMap
      const curCtx = editorCtxMap.get(id)

      return curCtx
    }
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
  addFile: (file: IFile, target: { name: string; kind: IFile['kind'] }) => boolean | void
  insertNodeToFolderData: (fileNode: IFile) => void
  deleteNode: (fileNode: IFile) => void
  addOpenedFile: (id: string) => void
  delOpenedFile: (id: string) => void
  setFolderData: (folderData: IFile[]) => void
  setEditorDelegate: (id: string, delegate: EditorDelegate<any>) => void
  getEditorContent: (id: string) => string
  getEditorDelegate: (id: string) => EditorDelegate<any> | undefined
  setEditorCtx: (id: string, ctx: EditorContext) => void
  getEditorCtx: (id: string) => EditorContext | undefined
}

export default useEditorStore
