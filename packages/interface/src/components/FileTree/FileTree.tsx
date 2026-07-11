import React, { memo, useCallback, useMemo, useRef, type FC } from 'react'
import { Tree, TreeApi } from 'react-arborist'
import type { TreeProps } from 'react-arborist/dist/module/types/tree-props'
import type { MoveFileInfo } from '../../contexts/FileSystemContext'
import { useFileSystem } from '../../contexts/FileSystemContext'
import { useFileTree } from '../../contexts/FileTreeContext'
import type { IFile } from '../../types/file'
import FileNode, { ContextMenuItem } from './FileNode'
import {
  captureFileMutationTarget,
  collectFileMutationProtection,
  getCurrentFileMutationNode,
  getCurrentFileMutationNodeInRoot,
  getCurrentFileMutationNodes,
} from './file-mutation'
import { moveFileNode } from './file-operator'
import { SimpleTree } from './types'

export interface FileTreeProps {
  data: IFile[]
  onSelect: (file: IFile) => void
  dndRootElement?: Node | null
  disableDrag?: boolean
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
  getFileIdsByPathPrefix?: (path: string) => string[]
  moveFileObjectsByPathPrefix?: (oldRootPath: string, newRootPath: string) => void
  deleteFileObjectsByIds?: (fileIds: string[]) => void
  deleteFileObjectsByPathPrefix?: (rootPath: string) => void
  onBeforeReplace?: (path: string) =>
    | { allowed: boolean; targetIds: string[] }
    | Promise<{ allowed: boolean; targetIds: string[] }>
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
    disableDrag = false,
    fillFlexParentComponent: FillFlexParent,
    onShowConfirm,
    onShowInputConfirm,
    onShowContextMenu,
    getFileObject,
    getFileObjectByPath,
    setFileObject,
    setFileObjectByPath,
    deletePathEntry,
    getFileIdsByPathPrefix,
    moveFileObjectsByPathPrefix,
    deleteFileObjectsByIds,
    deleteFileObjectsByPathPrefix,
    onBeforeReplace,
    createFile,
    updateFile,
    iconButtonComponent,
  } = props

  const { activeId, setFolderDataPure } = useFileTree()
  const { runFileMutation, pathJoin, fileExists, moveFilesToTargetFolder, readSubdirectory } =
    useFileSystem()
  const tree = useMemo(() => new SimpleTree<IFile>(data), [data])
  const treeRef = useRef<TreeApi<IFile> | null>(null)
  const loadedDirsRef = useRef<Set<string>>(new Set())
  const currentDataRef = useRef(data)
  currentDataRef.current = data
  const getCurrentFolderData = useCallback(() => currentDataRef.current, [])

  if (data === null || data.length === 0) return null

  const onToggle: TreeProps<IFile>['onToggle'] = async (id: string) => {
    const node = tree.find(id)
    if (!node) return

    const nodeData = node.data as IFile
    if (nodeData.kind !== 'dir' || !nodeData.path) return
    const rootId = data[0]?.id
    const target = captureFileMutationTarget(nodeData)
    if (!rootId || !target) return

    if (loadedDirsRef.current.has(nodeData.path)) return

    if (!nodeData.children || nodeData.children.length === 0) {
      try {
        const children = await readSubdirectory(nodeData.path)
        const currentTree = new SimpleTree(currentDataRef.current)
        const currentNode = getCurrentFileMutationNodeInRoot(
          currentTree,
          getFileObject,
          target,
          rootId,
        )
        if (!currentNode || currentNode.data.kind !== 'dir') return
        if (loadedDirsRef.current.has(target.path)) return
        if (children.length > 0) {
          currentNode.data.children = children
          loadedDirsRef.current.add(target.path)
          setFolderDataPure([...currentTree.data])
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
    const _dragNode = _dragNodes[0]
    const parentNode = args.parentNode

    if (!_dragNode || !parentNode || _dragNode.parent?.id === parentNode.id) {
      return
    }
    const sourceTargets = _dragNodes.map((dragNode) => captureFileMutationTarget(dragNode.data))
    const parentTarget = captureFileMutationTarget(parentNode.data)
    if (sourceTargets.some((target) => !target) || !parentTarget) return

    const capturedSourceTargets = sourceTargets.filter(
      (target): target is NonNullable<typeof target> => Boolean(target),
    )
    const targetPaths = await Promise.all(
      _dragNodes.map((dragNode) => pathJoin(parentTarget.path, dragNode.data.name)),
    )
    const isExist = (await Promise.all(targetPaths.map(fileExists))).some(Boolean)

    const move = async (replace = false) => {
      await runFileMutation(async (lease) => {
        const mutationTree = new SimpleTree(getCurrentFolderData())
        const currentParent = getCurrentFileMutationNode(mutationTree, getFileObject, parentTarget)
        const verifiedDragNodes = getCurrentFileMutationNodes(
          mutationTree,
          getFileObject,
          capturedSourceTargets,
        )
        if (!currentParent || !verifiedDragNodes) return
        if (verifiedDragNodes.some((dragNode) => dragNode.parent?.id === parentTarget.id)) return
        const sourceProtection = collectFileMutationProtection(
          verifiedDragNodes.map((dragNode) => dragNode.data),
          getFileObject,
          getFileIdsByPathPrefix,
        )
        lease.protectFileIds(sourceProtection.fileIds)
        lease.protectPaths(sourceProtection.paths)

        const currentTargetPaths = await Promise.all(
          verifiedDragNodes.map((dragNode) => pathJoin(parentTarget.path, dragNode.data.name)),
        )
        lease.protectPaths(currentTargetPaths)
        const existingTargetPaths = (
          await Promise.all(
            currentTargetPaths.map(async (path) => ({
              exists: await fileExists(path),
              path,
            })),
          )
        ).filter(({ exists }) => exists)

        if (!replace && existingTargetPaths.length > 0) {
          onShowConfirm({
            title: `Replace ${verifiedDragNodes[0].data.name}?`,
            onConfirm: () => void move(true),
          })
          return
        }

        const replacementIdsByPath = new Map<string, string[]>()
        if (replace && onBeforeReplace) {
          for (const { path } of existingTargetPaths) {
            const preflight = await onBeforeReplace(path)
            replacementIdsByPath.set(path, preflight.targetIds)
            lease.protectFileIds(preflight.targetIds)
            lease.protectPaths(
              preflight.targetIds
                .map((id) => getFileObject(id)?.path)
                .filter((path): path is string => !!path),
            )
            if (!preflight.allowed) return
          }
        }

        const res = await moveFilesToTargetFolder({
          files: capturedSourceTargets.map((target) => target.path),
          targetFolder: parentTarget.path,
          replaceExist: replace,
        })

        if (Array.isArray(res)) {
          const successfulSourcePaths = new Set(
            res.filter((moveFileInfo) => !moveFileInfo.is_replaced).map(({ old_path }) => old_path),
          )
          const dragIds = capturedSourceTargets
            .filter((target) => successfulSourcePaths.has(target.path))
            .map((target) => target.id)

          res.forEach((moveFileInfo) => {
            moveFileNode(
              mutationTree,
              moveFileInfo as MoveFileInfo,
              getFileObject,
              getFileObjectByPath,
              deletePathEntry,
              setFileObjectByPath,
              setFileObject,
              moveFileObjectsByPathPrefix,
              deleteFileObjectsByPathPrefix,
              {
                deleteFileObjectsByIds,
                replacementIds: replacementIdsByPath.get(moveFileInfo.old_path),
              },
            )
          })

          for (const id of dragIds) {
            mutationTree.move({ id, parentId: parentTarget.id, index: args.index })
          }
          loadedDirsRef.current.clear()
          setFolderDataPure(mutationTree.data)
        }
      })
    }

    if (isExist) {
      onShowConfirm({
        title: `Replace ${_dragNode.data.name}?`,
        onConfirm: () => void move(true),
      })
    } else {
      onShowConfirm({
        title: `Move ${_dragNode.data.name}?`,
        onConfirm: () => void move(),
      })
    }
  }

  const handleSelect = (nodes: { data: IFile }[] | null | undefined) => {
    if (nodes && nodes.length > 0 && nodes[0]?.data) {
      onSelect(nodes[0].data)
    }
  }

  return (
    <FillFlexParent>
      {(dimens) => (
        <Tree
          {...dimens}
          data={data}
          dndRootElement={dndRootElement}
          disableDrag={disableDrag}
          openByDefault={false}
          selection={activeId}
          indent={16}
          disableMultiSelection
          onSelect={handleSelect}
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
                    const newData = { id: `pending-${Date.now()}`, name: '', kind: 'pending_new_file' } as IFile
                    treeRef.current?.open(workspaceRoot.id)
                    tree.create({
                      parentId: workspaceRoot.id,
                      data: newData,
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
                    const newData = {
                      id: `pending-${Date.now()}`,
                      name: '',
                      kind: 'pending_new_folder',
                      children: [],
                    } as IFile
                    treeRef.current?.open(workspaceRoot.id)

                    tree.create({
                      parentId: workspaceRoot.id,
                      data: newData,
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
                getCurrentFolderData={getCurrentFolderData}
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
                getFileIdsByPathPrefix={getFileIdsByPathPrefix}
                moveFileObjectsByPathPrefix={moveFileObjectsByPathPrefix}
                deleteFileObjectsByPathPrefix={deleteFileObjectsByPathPrefix}
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
