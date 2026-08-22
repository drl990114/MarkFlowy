import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react'
import { Tree } from 'react-arborist'
import type { RowRendererProps, TreeApi } from 'react-arborist'
import type { TreeProps } from 'react-arborist/dist/module/types/tree-props'
import type { MoveFileInfo } from '../../contexts/FileSystemContext'
import { useFileSystem } from '../../contexts/FileSystemContext'
import { useFileTree } from '../../contexts/FileTreeContext'
import type { IFile } from '../../types/file'
import FileNode from './FileNode'
import type { ContextMenuItem, FileNodeComponentProps, FileTreeNodeIconRenderer } from './FileNode'
import {
  captureFileMutationTarget,
  collectFileMutationProtection,
  getCurrentFileMutationNode,
  getCurrentFileMutationNodeInRoot,
  getCurrentFileMutationNodes,
} from './file-mutation'
import { moveFileNode } from './file-operator'
import { FileTreeStickyRoot, FileTreeStickyViewport } from './styles'
import { SimpleTree } from './types'

const DEFAULT_FILE_TREE_INDENT_SIZE = 16
const DEFAULT_FILE_TREE_ROW_HEIGHT = 24

type FileTreeRowState = {
  revealRoot?: () => void
  rootId?: string
  suppressRoot: boolean
}

const FileTreeRowStateContext = createContext<FileTreeRowState>({ suppressRoot: false })

export interface FileTreeProps {
  data: IFile[]
  onSelect: (file: IFile) => void
  dndRootElement?: Node | null
  disableDrag?: boolean
  /** Hide tree operations when the backing adapter only supports reading existing files. */
  disableFileOperations?: boolean
  fillFlexParentComponent: FC<{
    children: (dimens: { width: number; height: number }) => React.ReactNode
  }>
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
  onBeforeReplace?: (
    path: string,
  ) =>
    | { allowed: boolean; targetIds: string[] }
    | Promise<{ allowed: boolean; targetIds: string[] }>
  createFile?: (opt?: Partial<IFile>) => IFile
  updateFile?: (file: IFile) => IFile
  iconButtonComponent?: React.ComponentType<any>
  /** Optional host renderer for product-specific file and folder icon systems. */
  renderNodeIcon?: FileTreeNodeIconRenderer
  /** Keep the first workspace folder visible above the virtualized rows while scrolling. */
  stickyRoot?: boolean
  /** Horizontal nesting step in pixels. */
  indentSize?: number
  /** Virtualized row height in pixels. */
  rowHeight?: number
}

export function shouldShowFileTreeStickyRoot(scrollOffset: number) {
  return scrollOffset > 0
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
    disableFileOperations = false,
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
    renderNodeIcon,
    stickyRoot = false,
    indentSize = DEFAULT_FILE_TREE_INDENT_SIZE,
    rowHeight = DEFAULT_FILE_TREE_ROW_HEIGHT,
  } = props

  const { activeId, setFolderDataPure } = useFileTree()
  const { runFileMutation, pathJoin, fileExists, moveFilesToTargetFolder, readSubdirectory } =
    useFileSystem()
  const tree = useMemo(() => new SimpleTree<IFile>(data), [data])
  const treeRef = useRef<TreeApi<IFile> | null>(null)
  const loadedDirsRef = useRef<Set<string>>(new Set())
  const loadingDirsRef = useRef<Set<string>>(new Set())
  const loadedDirsCacheVersionRef = useRef(0)
  const [loadingDirIds, setLoadingDirIds] = useState<ReadonlySet<string>>(() => new Set())
  const [loadedDirPaths, setLoadedDirPaths] = useState<ReadonlySet<string>>(() => new Set())
  const [showStickyRoot, setShowStickyRoot] = useState(false)
  // The pinned row lives outside react-arborist's provider, so a root toggle
  // needs one host render to read the NodeApi's updated open state.
  const [, setStickyRootRevision] = useState(0)
  const currentDataRef = useRef(data)
  currentDataRef.current = data
  const getCurrentFolderData = useCallback(() => currentDataRef.current, [])
  const rootId = data[0]?.id
  const revealRoot = useCallback(() => setShowStickyRoot(false), [])
  const fileTreeRowState = useMemo<FileTreeRowState>(
    () => ({ revealRoot, rootId, suppressRoot: stickyRoot && showStickyRoot }),
    [revealRoot, rootId, showStickyRoot, stickyRoot],
  )

  const handleScroll = useCallback<NonNullable<TreeProps<IFile>['onScroll']>>(
    ({ scrollOffset }) => {
      if (!stickyRoot) return

      const shouldShow = shouldShowFileTreeStickyRoot(scrollOffset)
      setShowStickyRoot((current) => (current === shouldShow ? current : shouldShow))
    },
    [stickyRoot],
  )

  if (data === null || data.length === 0) return null

  const onToggle: TreeProps<IFile>['onToggle'] = async (id: string) => {
    if (stickyRoot && showStickyRoot && id === rootId) {
      setStickyRootRevision((current) => current + 1)
    }

    const node = tree.find(id)
    if (!node) return

    const nodeData = node.data as IFile
    if (nodeData.kind !== 'dir' || !nodeData.path) return
    if (!treeRef.current?.isOpen(id)) return
    const workspaceRootId = data[0]?.id
    const target = captureFileMutationTarget(nodeData)
    if (!workspaceRootId || !target) return

    if (loadedDirsRef.current.has(nodeData.path) || loadingDirsRef.current.has(nodeData.path)) {
      return
    }

    if (!nodeData.children || nodeData.children.length === 0) {
      const cacheVersion = loadedDirsCacheVersionRef.current
      loadingDirsRef.current.add(target.path)
      setLoadingDirIds((current) => new Set(current).add(target.id))

      try {
        const children = await readSubdirectory(nodeData.path)
        if (cacheVersion !== loadedDirsCacheVersionRef.current) return

        const currentTree = new SimpleTree(currentDataRef.current)
        const currentNode = getCurrentFileMutationNodeInRoot(
          currentTree,
          getFileObject,
          target,
          workspaceRootId,
        )
        if (!currentNode || currentNode.data.kind !== 'dir') return
        if (loadedDirsRef.current.has(target.path)) return

        loadedDirsRef.current.add(target.path)
        setLoadedDirPaths((current) => new Set(current).add(target.path))
        if (children.length > 0) {
          currentNode.data.children = children
          setFolderDataPure([...currentTree.data])
        }
      } catch (error) {
        console.error('Failed to load subdirectory:', error)
      } finally {
        if (cacheVersion === loadedDirsCacheVersionRef.current) {
          loadingDirsRef.current.delete(target.path)
          setLoadingDirIds((current) => {
            if (!current.has(target.id)) return current

            const next = new Set(current)
            next.delete(target.id)
            return next
          })
        }
      }
    }
  }

  const onMove: TreeProps<IFile>['onMove'] = async (args) => {
    if (disableFileOperations) return

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
                .filter((candidatePath): candidatePath is string => !!candidatePath),
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
          setLoadedDirPaths((current) => (current.size === 0 ? current : new Set()))
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

  const renderFileNode = (
    nodeProps: Pick<FileNodeComponentProps, 'dragHandle' | 'node' | 'style' | 'tree'>,
    isRoot: boolean,
    isStickyRoot = false,
    isRootSuppressed = false,
  ) => (
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
      disableFileOperations={disableFileOperations}
      iconButtonComponent={iconButtonComponent as FC<any>}
      renderNodeIcon={renderNodeIcon}
      isLoading={loadingDirIds.has(nodeProps.node.id)}
      isEmpty={
        nodeProps.node.isOpen &&
        !!nodeProps.node.data.path &&
        loadedDirPaths.has(nodeProps.node.data.path) &&
        nodeProps.node.data.children?.length === 0
      }
      isStickyRoot={isStickyRoot}
      isRootSuppressed={isRootSuppressed}
    />
  )

  return (
    <FillFlexParent>
      {(dimens) => {
        const treeElement = (
          <Tree
            {...dimens}
            data={data}
            dndRootElement={dndRootElement}
            disableDrag={disableDrag}
            openByDefault={false}
            selection={activeId}
            indent={indentSize}
            rowHeight={rowHeight}
            rowClassName='mf-file-tree-item'
            renderRow={stickyRoot ? FileTreeRow : undefined}
            disableMultiSelection
            onSelect={handleSelect}
            onMove={onMove}
            onToggle={onToggle}
            onScroll={stickyRoot ? handleScroll : undefined}
            onContextMenu={(e) => {
              if (disableFileOperations) return

              const items: ContextMenuItem[] = []
              const workspaceRoot = data[0]
              if (workspaceRoot) {
                items.push(
                  {
                    label: 'New File',
                    value: 'new_file',
                    handler: () => {
                      const newData = {
                        id: `pending-${Date.now()}`,
                        name: '',
                        kind: 'pending_new_file',
                      } as IFile
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
                  loadedDirsCacheVersionRef.current += 1
                  loadedDirsRef.current.clear()
                  loadingDirsRef.current.clear()
                  setLoadingDirIds((current) => (current.size === 0 ? current : new Set()))
                  setLoadedDirPaths((current) => (current.size === 0 ? current : new Set()))
                }
              }
              return renderFileNode(nodeProps, isRoot, false, isRoot && showStickyRoot)
            }}
          </Tree>
        )

        if (!stickyRoot) return treeElement

        const rootTree = treeRef.current
        const rootNode = rootTree?.get(rootId ?? null)
        return (
          <FileTreeRowStateContext.Provider value={fileTreeRowState}>
            <FileTreeStickyViewport style={dimens}>
              {treeElement}
              {showStickyRoot && rootNode && rootTree ? (
                <FileTreeStickyRoot
                  aria-label={rootNode.data.name}
                  data-mf-file-tree-sticky-layer=''
                  role='tree'
                  style={{ height: rowHeight }}
                >
                  <div
                    aria-expanded={rootNode.isInternal ? rootNode.isOpen : undefined}
                    aria-label={rootNode.data.name}
                    aria-level={1}
                    aria-selected={rootNode.isSelected}
                    className='mf-file-tree-item'
                    data-mf-file-tree-sticky-item=''
                    onClick={rootNode.handleClick}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return

                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        rootNode.select()
                        rootNode.activate()
                        rootNode.toggle()
                        return
                      }

                      if (event.key === 'ArrowLeft') {
                        event.preventDefault()
                        event.stopPropagation()
                        if (rootNode.isInternal && rootNode.isOpen) rootNode.close()
                        return
                      }

                      if (event.key === 'ArrowRight') {
                        event.preventDefault()
                        event.stopPropagation()
                        if (rootNode.isInternal && !rootNode.isOpen) rootNode.open()
                        return
                      }

                      if (event.key === 'Home' || event.key === 'ArrowUp') {
                        event.preventDefault()
                        event.stopPropagation()
                        revealRoot()
                        rootTree.focus(rootNode)
                      }
                    }}
                    role='treeitem'
                    style={{ height: '100%' }}
                    tabIndex={0}
                  >
                    {renderFileNode(
                      {
                        dragHandle: undefined,
                        node: rootNode,
                        style: { paddingLeft: 0 },
                        tree: rootTree,
                      },
                      true,
                      true,
                    )}
                  </div>
                </FileTreeStickyRoot>
              ) : null}
            </FileTreeStickyViewport>
          </FileTreeRowStateContext.Provider>
        )
      }}
    </FillFlexParent>
  )
}

type FileTreeRowProps = RowRendererProps<IFile> & Partial<FileTreeRowState>

export function FileTreeRow({
  attrs,
  children,
  innerRef,
  node,
  revealRoot: revealRootOverride,
  rootId: rootIdOverride,
  suppressRoot: suppressRootOverride,
}: FileTreeRowProps) {
  const rowState = useContext(FileTreeRowStateContext)
  const revealRoot = revealRootOverride ?? rowState.revealRoot
  const rootId = rootIdOverride ?? rowState.rootId
  const suppressRoot = suppressRootOverride ?? rowState.suppressRoot
  const isRoot = node.id === rootId
  const suppressed = isRoot && suppressRoot

  return (
    <div
      {...attrs}
      ref={innerRef}
      aria-label={suppressed ? node.data.name : attrs['aria-label']}
      data-mf-file-tree-root-row={isRoot || undefined}
      data-mf-file-tree-root-row-suppressed={suppressed || undefined}
      onClick={node.handleClick}
      onFocus={(event) => {
        if (suppressed) revealRoot?.()
        event.stopPropagation()
      }}
    >
      {children}
    </div>
  )
}

export default memo(FileTree)
