import React, { type FC } from 'react'
import { memo, useDeferredValue, useMemo, useRef } from 'react'
import { Tree, TreeApi } from 'react-arborist'
import type { TreeProps } from 'react-arborist/dist/module/types/tree-props'
import type { IFile } from '../../types/file'
import { useFileSystem } from '../../contexts/FileSystemContext'
import { useFileTree } from '../../contexts/FileTreeContext'
import FileNode, { ContextMenuItem } from './FileNode'
import { moveFileNode } from './file-operator'
import { SimpleTree } from './types'
import type { MoveFileInfo } from '../../contexts/FileSystemContext'

export interface FileTreeProps {
  data: IFile[]
  onSelect: (file: IFile) => void
  dndRootElement: Node
  fillFlexParentComponent: FC<{ children: (dimens: { width: number; height: number }) => React.ReactNode }>
  onShowConfirm: (params: { title: string; onConfirm: () => void }) => void
  onShowInputConfirm?: (params: {
    title: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onClose: () => void
  }) => void
  onShowContextMenu: (params: { x: number; y: number; items: ContextMenuItem[] }) => void
  getFileObject: (id: string) => IFile | undefined
  getFileObjectByPath: (path: string) => IFile | undefined
  setFileObject?: (id: string, file: IFile) => void
  setFileObjectByPath?: (path: string, file: IFile) => void
  deletePathEntry?: (path: string) => void
  createFile?: (opt?: Partial<IFile>) => IFile
  updateFile?: (file: IFile) => IFile
  iconButtonComponent?: React.ComponentType<any>
}

export const fileTreeHandler: {
  rootTree: undefined | TreeApi<IFile>
  updateTreeView: undefined | ((params: { data: IFile[] }) => void)
  clearLoadedDirsCache: undefined | (() => void)
} = {
  rootTree: undefined,
  updateTreeView: undefined,
  clearLoadedDirsCache: undefined,
}

const FileTree: FC<FileTreeProps> = (props) => {
  const {
    data,
    onSelect,
    dndRootElement,
    fillFlexParentComponent: FillFlexParent,
    onShowConfirm,
    onShowInputConfirm,
    onShowContextMenu,
    getFileObject,
    getFileObjectByPath,
    setFileObject,
    setFileObjectByPath,
    deletePathEntry,
    createFile,
    updateFile,
    iconButtonComponent,
  } = props

  const { activeId, setFolderDataPure } = useFileTree()
  const { pathJoin, fileExists, moveFilesToTargetFolder, readSubdirectory } = useFileSystem()
  const deferredActiveId = useDeferredValue(activeId)
  const tree = useMemo(() => new SimpleTree<IFile>(data), [data])
  const treeRef = useRef<TreeApi<IFile> | null>(null)
  const loadedDirsRef = useRef<Set<string>>(new Set())

  if (data === null) return null

  const onToggle: TreeProps<IFile>['onToggle'] = async (id: string) => {
    const node = tree.find(id)
    if (!node) return

    const nodeData = node.data as IFile
    if (nodeData.kind !== 'dir' || !nodeData.path) return

    if (loadedDirsRef.current.has(nodeData.path)) return

    if (!nodeData.children || nodeData.children.length === 0) {
      try {
        const children = await readSubdirectory(nodeData.path)
        if (children.length > 0) {
          nodeData.children = children
          loadedDirsRef.current.add(nodeData.path)
          setFolderDataPure([...tree.data])
        }
      } catch (error) {
        console.error('Failed to load subdirectory:', error)
      }
    }
  }

  const onMove: TreeProps<IFile>['onMove'] = async (args) => {
    const _dragNodes = args.dragNodes.filter((node) => {
      return !args.dragIds.includes(node.parent?.id || '')
    })
    // current only can move one file
    const _dragNode = _dragNodes[0]
    const parentNode = args.parentNode

    if (!parentNode || _dragNode.parent?.id === parentNode.id) {
      return
    }
    const targetPath = await pathJoin(parentNode.data.path || '', _dragNode.data.name)
    const isExist = await fileExists(targetPath)

    if (isExist) {
      onShowConfirm({
        title: `Replace ${_dragNode.data.name}?`,
        onConfirm: () => move(true),
      })
    } else {
      onShowConfirm({
        title: `Move ${_dragNode.data.name}?`,
        onConfirm: () => move(),
      })
    }

    const move = async (replace = false) => {
      const res = await moveFilesToTargetFolder({
        files: _dragNodes.map((node) => node.data.path || ''),
        targetFolder: parentNode.data.path || '',
        replaceExist: replace,
      })

      if (Array.isArray(res)) {
        res.forEach((moveFileInfo) => {
          moveFileNode(
            tree,
            moveFileInfo as MoveFileInfo,
            getFileObject,
            getFileObjectByPath,
            deletePathEntry,
            setFileObjectByPath,
            setFileObject,
          )
        })

        const _dragIds = _dragNodes.map((node) => node.data.id)
        for (const id of _dragIds) {
          tree.move({ id, parentId: args.parentId, index: args.index })
        }
        setFolderDataPure(tree.data)
      }
    }
  }

  if (!dndRootElement) {
    return null
  }

  return (
    <FillFlexParent>
      {(dimens) => (
        <Tree
          {...dimens}
          data={data}
          dndRootElement={dndRootElement}
          openByDefault={false}
          initialOpenState={{
            [data[0]?.id]: true,
          }}
          selection={deferredActiveId}
          indent={16}
          disableMultiSelection
          onSelect={(node) => onSelect(node[0]?.data)}
          onMove={onMove}
          onToggle={onToggle}
          onContextMenu={(e) => {
            const items: ContextMenuItem[] = []
            const workspaceRoot = data[0]
            if (workspaceRoot) {
              items.push(
                {
                  label: 'New File',
                  value: 'new_file',
                  handler: () => {
                    const data = { id: `pending-${Date.now()}`, name: '', kind: 'pending_new_file' } as IFile
                    treeRef.current?.open(workspaceRoot.id)
                    tree.create({
                      parentId: workspaceRoot.id,
                      data,
                    })
                    treeRef.current?.create({
                      parentId: workspaceRoot.id,
                      index: 0,
                    })

                    setFolderDataPure(tree.data)
                  },
                },
                {
                  label: 'New Folder',
                  value: 'new_folder',
                  handler: () => {
                    const data = {
                      id: `pending-${Date.now()}`,
                      name: '',
                      kind: 'pending_new_folder',
                      children: [],
                    } as IFile
                    treeRef.current?.open(workspaceRoot.id)

                    tree.create({
                      parentId: workspaceRoot.id,
                      data,
                    })
                    treeRef.current?.create({
                      parentId: workspaceRoot.id,
                      index: 0,
                      type: 'internal',
                    })

                    setFolderDataPure(tree.data)
                  },
                },
              )
            }

            if (items.length === 0) return
            onShowContextMenu({
              x: e.clientX,
              y: e.clientY,
              items,
            })
          }}
        >
          {(nodeProps) => {
            const isRoot = nodeProps.node.id === data[0]?.id
            if (isRoot) {
              treeRef.current = nodeProps.tree
              fileTreeHandler.rootTree = nodeProps.tree
              fileTreeHandler.updateTreeView = (params) => {
                fileTreeHandler.rootTree?.update({
                  data: params.data,
                })
                setFolderDataPure(params.data)
              }
              fileTreeHandler.clearLoadedDirsCache = () => {
                loadedDirsRef.current.clear()
              }
            }
            return (
              <FileNode
                {...nodeProps}
                simpleTree={tree}
                setFolderData={setFolderDataPure}
                isRoot={isRoot}
                onShowConfirm={onShowConfirm}
                onShowInputConfirm={onShowInputConfirm}
                onShowContextMenu={onShowContextMenu}
                getFileObject={getFileObject}
                getFileObjectByPath={getFileObjectByPath}
                setFileObject={setFileObject}
                setFileObjectByPath={setFileObjectByPath}
                deletePathEntry={deletePathEntry}
                createFile={createFile}
                updateFile={updateFile}
                fileTreeHandler={fileTreeHandler}
                iconButtonComponent={iconButtonComponent as FC<any>}
              />
            )
          }}
        </Tree>
      )}
    </FillFlexParent>
  )
}

export default memo(FileTree)
