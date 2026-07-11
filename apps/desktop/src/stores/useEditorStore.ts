import { createFile, getFolderPathFromPath, isMdFile, releaseSecurityScope, type IFile } from '@/helper/filesys';
import { getPathIdentityKey } from '@/helper/pathIdentity';
import { isEmptyEditor } from '@/services/editor-file';
import { invoke } from '@tauri-apps/api/core';
import { nanoid } from 'nanoid';
import type { EditorContext, EditorDelegate } from 'rme';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

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

const findFileNodeByPath = (path: string, rootFile?: IFile): IFile | undefined => {
  if (!rootFile) return undefined
  const identity = getPathIdentityKey(path)
  if (rootFile.path && getPathIdentityKey(rootFile.path) === identity) return rootFile

  for (const child of rootFile.children ?? []) {
    const match = findFileNodeByPath(path, child)
    if (match) return match
  }
}

type BaseIFile = { name: string; kind: IFile['kind'] }

function isSameFile(current: BaseIFile, target: BaseIFile): boolean {
  return current.name === target.name && current.kind === target.kind
}

const hasSameFile = (fileNodeList: IFile[], target: BaseIFile) => {
  return !!fileNodeList.find((file) => isSameFile(file, target))
}

export type EditorSplitDirection = 'horizontal' | 'vertical'
export type EditorSplitPlacement = 'before' | 'after'
export type EditorLayoutNode = EditorLayoutBranch | EditorLayoutLeaf

export interface EditorLayoutBranch {
  type: 'branch'
  id: string
  direction: EditorSplitDirection
  sizes: number[]
  children: EditorLayoutNode[]
}

export interface EditorLayoutLeaf {
  type: 'leaf'
  id: string
  opened: string[]
  activeId?: string
}

const createEditorLeaf = (opened: string[] = [], activeId?: string): EditorLayoutLeaf => ({
  type: 'leaf',
  id: nanoid(),
  opened,
  activeId,
})

const createDefaultEditorLayout = () => createEditorLeaf()

const isEditorLeaf = (node: EditorLayoutNode): node is EditorLayoutLeaf => node.type === 'leaf'

const unique = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)))

const normalizeSizes = (length: number) => {
  if (length <= 0) return []
  return Array.from({ length }, () => 100 / length)
}

const getAllGroups = (node: EditorLayoutNode): EditorLayoutLeaf[] => {
  if (isEditorLeaf(node)) return [node]
  return node.children.flatMap(getAllGroups)
}

const getAllOpenedIds = (node: EditorLayoutNode) => {
  return unique(getAllGroups(node).flatMap((group) => group.opened))
}

const getFirstGroup = (node: EditorLayoutNode) => getAllGroups(node)[0]

const findGroup = (node: EditorLayoutNode, groupId?: string): EditorLayoutLeaf | undefined => {
  if (!groupId) return undefined
  if (isEditorLeaf(node)) return node.id === groupId ? node : undefined

  for (const child of node.children) {
    const group = findGroup(child, groupId)
    if (group) return group
  }
}

const findGroupContainingFile = (
  node: EditorLayoutNode,
  fileId: string,
): EditorLayoutLeaf | undefined => {
  return getAllGroups(node).find((group) => group.opened.includes(fileId))
}

const syncEditorLayoutState = (layout: EditorLayoutNode, preferredGroupId?: string) => {
  const groups = getAllGroups(layout)
  const activeGroup = groups.find((group) => group.id === preferredGroupId) || groups[0]
  let activeId = activeGroup?.activeId

  if (activeGroup && activeId && !activeGroup.opened.includes(activeId)) {
    activeId = activeGroup.opened[0]
    activeGroup.activeId = activeId
  }

  return {
    opened: getAllOpenedIds(layout),
    activeId,
    activeGroupId: activeGroup?.id,
  }
}

const addFileToGroup = (group: EditorLayoutLeaf, id: string) => {
  if (
    group.activeId &&
    isEmptyEditor(group.activeId) &&
    !isEmptyEditor(id) &&
    !group.opened.includes(id)
  ) {
    const activeEmptyFileIndex = group.opened.findIndex((openedId) => openedId === group.activeId)
    if (activeEmptyFileIndex > -1) {
      group.opened.splice(activeEmptyFileIndex, 1, id)
      group.activeId = id
      return true
    }
  }

  if (!group.opened.includes(id)) {
    group.opened.push(id)
  }

  return false
}

const insertFileToGroup = (group: EditorLayoutLeaf, id: string, index?: number) => {
  if (group.opened.includes(id)) return

  if (typeof index === 'number') {
    const insertIndex = Math.max(0, Math.min(index, group.opened.length))
    group.opened.splice(insertIndex, 0, id)
    return
  }

  group.opened.push(id)
}

const closeFileInGroup = (group: EditorLayoutLeaf, id: string) => {
  const curIndex = group.opened.findIndex((openedId) => openedId === id)
  if (curIndex < 0) return

  group.opened.splice(curIndex, 1)

  if (group.activeId === id) {
    group.activeId = group.opened[curIndex] || group.opened[curIndex - 1]
  }
}

const removeFileFromAllGroups = (node: EditorLayoutNode, id: string) => {
  getAllGroups(node).forEach((group) => closeFileInGroup(group, id))
}

const splitGroupInLayout = (
  node: EditorLayoutNode,
  groupId: string,
  direction: EditorSplitDirection,
  insertion: EditorSplitPlacement,
): { node: EditorLayoutNode; newGroup?: EditorLayoutLeaf } => {
  if (isEditorLeaf(node)) {
    if (node.id !== groupId) return { node }

    const copiedActiveId = node.activeId || node.opened[0]
    const newGroup = createEditorLeaf(copiedActiveId ? [copiedActiveId] : [], copiedActiveId)
    const children = insertion === 'before' ? [newGroup, node] : [node, newGroup]

    return {
      node: {
        type: 'branch',
        id: nanoid(),
        direction,
        sizes: normalizeSizes(children.length),
        children,
      },
      newGroup,
    }
  }

  const nextChildren: EditorLayoutNode[] = []
  let newGroup: EditorLayoutLeaf | undefined

  for (const child of node.children) {
    if (isEditorLeaf(child) && child.id === groupId) {
      const copiedActiveId = child.activeId || child.opened[0]
      newGroup = createEditorLeaf(copiedActiveId ? [copiedActiveId] : [], copiedActiveId)

      if (node.direction === direction) {
        if (insertion === 'before') {
          nextChildren.push(newGroup, child)
        } else {
          nextChildren.push(child, newGroup)
        }
      } else {
        const branchChildren = insertion === 'before' ? [newGroup, child] : [child, newGroup]
        nextChildren.push({
          type: 'branch',
          id: nanoid(),
          direction,
          sizes: normalizeSizes(branchChildren.length),
          children: branchChildren,
        })
      }
      continue
    }

    const result = splitGroupInLayout(child, groupId, direction, insertion)
    nextChildren.push(result.node)
    if (result.newGroup) {
      newGroup = result.newGroup
    }
  }

  return {
    node: {
      ...node,
      children: nextChildren,
      sizes: newGroup ? normalizeSizes(nextChildren.length) : node.sizes,
    },
    newGroup,
  }
}

const removeGroupFromLayout = (
  node: EditorLayoutNode,
  groupId: string,
): { node: EditorLayoutNode; removed: boolean } => {
  if (isEditorLeaf(node)) {
    if (node.id === groupId) {
      return { node: createDefaultEditorLayout(), removed: true }
    }

    return { node, removed: false }
  }

  const children: EditorLayoutNode[] = []
  let removed = false

  for (const child of node.children) {
    if (isEditorLeaf(child) && child.id === groupId) {
      removed = true
      continue
    }

    const result = removeGroupFromLayout(child, groupId)
    children.push(result.node)
    removed = removed || result.removed
  }

  if (!removed) return { node, removed: false }

  if (children.length === 0) {
    return { node: createDefaultEditorLayout(), removed: true }
  }

  if (children.length === 1) {
    return { node: children[0], removed: true }
  }

  return {
    node: {
      ...node,
      children,
      sizes: normalizeSizes(children.length),
    },
    removed: true,
  }
}

const pruneEmptyEditorGroups = (node: EditorLayoutNode): EditorLayoutNode => {
  const groups = getAllGroups(node)

  if (groups.length <= 1) return node
  if (groups.every((group) => group.opened.length === 0)) return createDefaultEditorLayout()

  if (isEditorLeaf(node)) return node

  const children = node.children
    .map(pruneEmptyEditorGroups)
    .filter((child) => !isEditorLeaf(child) || child.opened.length > 0)

  if (children.length === 0) return createDefaultEditorLayout()
  if (children.length === 1) return children[0]

  return {
    ...node,
    children,
    sizes: normalizeSizes(children.length),
  }
}

const updateBranchSizes = (
  node: EditorLayoutNode,
  branchId: string,
  sizes: number[],
): EditorLayoutNode => {
  if (isEditorLeaf(node)) return node

  if (node.id === branchId && sizes.length === node.children.length) {
    const total = sizes.reduce((sum, size) => sum + size, 0)
    return {
      ...node,
      sizes: total > 0 ? sizes.map((size) => (size / total) * 100) : normalizeSizes(sizes.length),
    }
  }

  return {
    ...node,
    children: node.children.map((child) => updateBranchSizes(child, branchId, sizes)),
  }
}

const cloneEditorLayout = (node: EditorLayoutNode): EditorLayoutNode => {
  if (isEditorLeaf(node)) {
    return {
      ...node,
      opened: [...node.opened],
    }
  }

  return {
    ...node,
    sizes: [...node.sizes],
    children: node.children.map(cloneEditorLayout),
  }
}

const commitEditorLayoutState = (layout: EditorLayoutNode, activeGroupId?: string) => {
  const editorLayout = cloneEditorLayout(pruneEmptyEditorGroups(layout))
  return {
    editorLayout,
    ...syncEditorLayoutState(editorLayout, activeGroupId),
  }
}

const useEditorStore = create<EditorStore>()(subscribeWithSelector((set, get) => {
  const initialEditorLayout = createDefaultEditorLayout()

  return {
    opened: [],
    activeId: undefined,
    activeGroupId: initialEditorLayout.id,
    editorLayout: initialEditorLayout,
    folderData: null,
    editorDelegateMap: new Map(),
    editorCtxMap: new Map(),

    getRootPath: () => get().folderData?.[0].path,

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

    insertNodeToFolderData: (fileNode, replacedIds = []) => {
      set((state) => {
        const root = state.folderData?.[0]
        if (!fileNode || !root) return state

        const replacementIds = new Set(replacedIds.filter((id) => id !== fileNode.id))
        let replacement:
          | { index: number; parent: IFile; previousFile: IFile }
          | undefined
        const removeReplacementNodes = (parent: IFile) => {
          if (!parent.children) return

          for (let index = parent.children.length - 1; index >= 0; index -= 1) {
            const child = parent.children[index]
            if (replacementIds.has(child.id)) {
              replacement ??= { index, parent, previousFile: child }
              parent.children.splice(index, 1)
            } else {
              removeReplacementNodes(child)
            }
          }
        }
        removeReplacementNodes(root)

        if (replacement) {
          const { index, parent, previousFile } = replacement
          parent.children ??= []
          parent.children.splice(Math.min(index, parent.children.length), 0, {
            ...previousFile,
            ...fileNode,
          })
          replacementIds.forEach((id) => removeFileFromAllGroups(state.editorLayout, id))
          const synced = commitEditorLayoutState(state.editorLayout, state.activeGroupId)

          return {
            ...state,
            ...synced,
            folderData: [...state.folderData!],
          }
        }

        const parent =
          fileNode.kind === 'dir' ? fileNode : findParentNodeByPath(fileNode.path!, root)
        if (!parent) return state

        parent.children ??= []
        const sameFileIndex = parent.children.findIndex((file) => {
          if (fileNode.path && file.path === fileNode.path) return true
          return isSameFile(file, fileNode)
        })

        if (sameFileIndex < 0) {
          parent.children.push(fileNode)
          return {
            ...state,
            folderData: [...state.folderData!],
          }
        }

        const previousFile = parent.children[sameFileIndex]
        parent.children[sameFileIndex] = {
          ...previousFile,
          ...fileNode,
        }

        const synced =
          previousFile.id === fileNode.id
            ? {}
            : (() => {
                removeFileFromAllGroups(state.editorLayout, previousFile.id)
                return commitEditorLayoutState(state.editorLayout, state.activeGroupId)
              })()

        return {
          ...state,
          ...synced,
          folderData: [...state.folderData!],
        }
      })
    },

    getFileNodeByPath: (path) => findFileNodeByPath(path, get().folderData?.[0]),

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
      set((state) => {
        const targetGroup =
          findGroup(state.editorLayout, state.activeGroupId) ||
          findGroupContainingFile(state.editorLayout, id) ||
          getFirstGroup(state.editorLayout)

        if (targetGroup) {
          addFileToGroup(targetGroup, id)
          targetGroup.activeId = id
        }

        const synced = commitEditorLayoutState(state.editorLayout, targetGroup?.id)

        return {
          ...state,
          ...synced,
        }
      })
    },

    addOpenedFile: (id: string) => {
      set((state) => {
        const activeGroup =
          findGroup(state.editorLayout, state.activeGroupId) || getFirstGroup(state.editorLayout)
        const replacedEmptyTab = activeGroup ? addFileToGroup(activeGroup, id) : false
        const synced = commitEditorLayoutState(state.editorLayout, state.activeGroupId)

        return {
          ...state,
          ...synced,
          activeId: replacedEmptyTab ? id : state.activeId,
        }
      })
    },

    delOpenedFile: (id: string) => {
      set((state) => {
        removeFileFromAllGroups(state.editorLayout, id)
        const synced = commitEditorLayoutState(state.editorLayout, state.activeGroupId)

        return {
          ...state,
          ...synced,
        }
      })
    },

    delOtherOpenedFile: (id: string) => {
      set((state) => {
        const activeGroup =
          findGroup(state.editorLayout, state.activeGroupId) ||
          findGroupContainingFile(state.editorLayout, id)

        if (activeGroup) {
          activeGroup.opened = activeGroup.opened.includes(id) ? [id] : []
          activeGroup.activeId = activeGroup.opened[0]
        }

        const synced = commitEditorLayoutState(state.editorLayout, activeGroup?.id)

        return {
          ...state,
          ...synced,
        }
      })
    },

    delAllOpenedFile: () => {
      set((state) => {
        const editorLayout = createDefaultEditorLayout()

        return {
          ...state,
          editorLayout,
          activeGroupId: editorLayout.id,
          activeId: undefined,
          opened: [],
        }
      })
    },

    setActiveGroupId: (groupId) => {
      set((state) => {
        const synced = commitEditorLayoutState(state.editorLayout, groupId)

        return {
          ...state,
          ...synced,
        }
      })
    },

    getActiveGroup: () => {
      const state = get()
      return findGroup(state.editorLayout, state.activeGroupId) || getFirstGroup(state.editorLayout)
    },

    getGroup: (groupId) => {
      return findGroup(get().editorLayout, groupId)
    },

    openFileInGroup: (groupId, id, options = {}) => {
      set((state) => {
        const group = findGroup(state.editorLayout, groupId) || getFirstGroup(state.editorLayout)
        if (!group) return state

        addFileToGroup(group, id)
        if (options.activate !== false) {
          group.activeId = id
        }

        const synced = commitEditorLayoutState(
          state.editorLayout,
          options.activate === false ? state.activeGroupId : group.id,
        )

        return {
          ...state,
          ...synced,
        }
      })
    },

    closeFileInGroup: (groupId, id) => {
      set((state) => {
        const group = findGroup(state.editorLayout, groupId)
        if (!group) return state

        closeFileInGroup(group, id)
        const synced = commitEditorLayoutState(state.editorLayout, group.id)

        return {
          ...state,
          ...synced,
        }
      })
    },

    closeOtherFilesInGroup: (groupId, id) => {
      set((state) => {
        const group = findGroup(state.editorLayout, groupId)
        if (!group) return state

        group.opened = group.opened.includes(id) ? [id] : []
        group.activeId = group.opened[0]
        const synced = commitEditorLayoutState(state.editorLayout, group.id)

        return {
          ...state,
          ...synced,
        }
      })
    },

    closeAllFilesInGroup: (groupId) => {
      set((state) => {
        const group = findGroup(state.editorLayout, groupId)
        if (!group) return state

        group.opened = []
        group.activeId = undefined
        const synced = commitEditorLayoutState(state.editorLayout, group.id)

        return {
          ...state,
          ...synced,
        }
      })
    },

    moveFileToGroup: (sourceGroupId, targetGroupId, id, targetIndex) => {
      set((state) => {
        const sourceGroup = findGroup(state.editorLayout, sourceGroupId)
        const targetGroup = findGroup(state.editorLayout, targetGroupId)

        if (!sourceGroup || !targetGroup || !sourceGroup.opened.includes(id)) return state

        if (sourceGroup.id === targetGroup.id) {
          targetGroup.activeId = id
        } else {
          closeFileInGroup(sourceGroup, id)
          insertFileToGroup(targetGroup, id, targetIndex)
          targetGroup.activeId = id
        }

        const synced = commitEditorLayoutState(state.editorLayout, targetGroup.id)

        return {
          ...state,
          ...synced,
        }
      })
    },

    splitGroup: (groupId, direction, insertion = 'after') => {
      let createdGroupId: string | undefined

      set((state) => {
        const result = splitGroupInLayout(state.editorLayout, groupId, direction, insertion)
        if (!result.newGroup) return state

        createdGroupId = result.newGroup.id
        const synced = commitEditorLayoutState(result.node, result.newGroup.id)

        return {
          ...state,
          ...synced,
        }
      })

      return createdGroupId
    },

    closeGroup: (groupId) => {
      set((state) => {
        const result = removeGroupFromLayout(state.editorLayout, groupId)
        if (!result.removed) return state

        const synced = commitEditorLayoutState(result.node, state.activeGroupId)

        return {
          ...state,
          ...synced,
        }
      })
    },

    setBranchSizes: (branchId, sizes) => {
      set((state) => {
        const editorLayout = updateBranchSizes(state.editorLayout, branchId, sizes)
        const synced = commitEditorLayoutState(editorLayout, state.activeGroupId)

        return {
          ...state,
          ...synced,
        }
      })
    },

    setEditorLayout: (editorLayout, activeGroupId) => {
      const synced = commitEditorLayoutState(editorLayout, activeGroupId)

      set((state) => ({
        ...state,
        ...synced,
      }))
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

    clearEditorDelegate: (id) =>
      set((state) => {
        if (!state.editorDelegateMap.has(id)) return state

        const editorDelegateMap = new Map(state.editorDelegateMap)
        editorDelegateMap.delete(id)
        return { ...state, editorDelegateMap }
      }),

    setFolderData: (folderData) => {
      const prevRootPath = get().getRootPath()
      const nextRootPath = folderData?.[0]?.path
      const editorLayout = createDefaultEditorLayout()

      if (prevRootPath && prevRootPath !== nextRootPath) {
        releaseSecurityScope(prevRootPath).catch(() => {})
      }

      set((state) => ({
        ...state,
        folderData,
        editorLayout,
        activeGroupId: editorLayout.id,
        opened: [],
        activeId: undefined,
      }))
    },

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

    clearEditorCtx: (id) =>
      set((state) => {
        if (!state.editorCtxMap.has(id)) return state

        const editorCtxMap = new Map(state.editorCtxMap)
        editorCtxMap.delete(id)
        return { ...state, editorCtxMap }
      }),

    clearEditorResources: (id) =>
      set((state) => {
        if (!state.editorCtxMap.has(id) && !state.editorDelegateMap.has(id)) {
          return state
        }

        const editorCtxMap = new Map(state.editorCtxMap)
        const editorDelegateMap = new Map(state.editorDelegateMap)
        editorCtxMap.delete(id)
        editorDelegateMap.delete(id)

        return {
          ...state,
          editorCtxMap,
          editorDelegateMap,
        }
      }),

    getEditorCtx: (id) => {
      const editorCtxMap = get().editorCtxMap
      const curCtx = editorCtxMap.get(id)

      return curCtx
    },
  }
}))

type EditorStore = {
  opened: string[]
  activeId?: string
  activeGroupId?: string
  editorLayout: EditorLayoutNode
  /**
   * folderData only has root file.
   */
  folderData: null | IFile[]
  editorCtxMap: Map<string, EditorContext>
  editorDelegateMap: Map<string, EditorDelegate<any>>
  getRootPath: () => string | undefined
  setActiveId: (id: string) => void
  addFile: (file: IFile, target: BaseIFile) => Promise<void | IFile>
  insertNodeToFolderData: (fileNode: IFile, replacedIds?: string[]) => void
  getFileNodeByPath: (path: string) => IFile | undefined
  deleteNode: (fileNode: IFile) => Promise<void>
  trashNode: (fileNode: IFile) => Promise<void>
  addOpenedFile: (id: string) => void
  delOpenedFile: (id: string) => void
  delOtherOpenedFile: (id: string) => void
  delAllOpenedFile: () => void
  setActiveGroupId: (groupId: string) => void
  getActiveGroup: () => EditorLayoutLeaf | undefined
  getGroup: (groupId: string) => EditorLayoutLeaf | undefined
  openFileInGroup: (groupId: string, id: string, options?: { activate?: boolean }) => void
  closeFileInGroup: (groupId: string, id: string) => void
  closeOtherFilesInGroup: (groupId: string, id: string) => void
  closeAllFilesInGroup: (groupId: string) => void
  moveFileToGroup: (
    sourceGroupId: string,
    targetGroupId: string,
    id: string,
    targetIndex?: number,
  ) => void
  splitGroup: (
    groupId: string,
    direction: EditorSplitDirection,
    insertion?: EditorSplitPlacement,
  ) => string | undefined
  closeGroup: (groupId: string) => void
  setBranchSizes: (branchId: string, sizes: number[]) => void
  setEditorLayout: (editorLayout: EditorLayoutNode, activeGroupId?: string) => void
  setFolderData: (folderData: IFile[] | null) => void
  /**
   * dont change opened and activeId
   * @param folderData
   * @returns
   */
  setFolderDataPure: (folderData: IFile[]) => void
  setEditorDelegate: (id: string, delegate: EditorDelegate<any>) => void
  clearEditorDelegate: (id: string) => void
  getEditorContent: (id: string) => string
  getEditorDelegate: (id: string) => EditorDelegate<any> | undefined
  setEditorCtx: (id: string, ctx: EditorContext) => void
  clearEditorCtx: (id: string) => void
  clearEditorResources: (id: string) => void
  getEditorCtx: (id: string) => EditorContext | undefined
}

export default useEditorStore
