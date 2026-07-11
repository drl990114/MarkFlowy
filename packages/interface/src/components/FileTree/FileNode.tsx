import React, { type FC } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { toast } from 'zens'
import { useFileSystem } from '../../contexts/FileSystemContext'
import { useFileTree } from '../../contexts/FileTreeContext'
import type { IFile } from '../../types/file'
import {
  captureFileMutationTarget,
  collectFileMutationProtection,
  getCurrentFileMutationNode,
} from './file-mutation'
import { moveFileNode } from './file-operator'
import NewFileInput from './NewFileInput'
import { NodeContainer } from './styles'
import { SimpleTree } from './types'
import { getFileNameFromPath } from './verify-file-name'

export interface FileNodeComponentProps extends NodeRendererProps<IFile> {
  getCurrentFolderData: () => IFile[]
  setFolderData: (data: IFile[]) => void
  isRoot?: boolean
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
  deleteFileObjectsByPathPrefix?: (rootPath: string) => void
  createFile?: (opt?: Partial<IFile>) => IFile
  updateFile?: (file: IFile) => IFile
  fileTreeHandler?: {
    rootTree: any
    updateTreeView: ((params: { data: IFile[] }) => void) | undefined
    clearLoadedDirsCache?: () => void
  }
  disableFileOperations?: boolean
  iconButtonComponent?: FC<any>
}

export interface ContextMenuItem {
  label: string
  value: string
  handler: () => void
}

const extFileIconClassMap: Record<string, string> = {
  md: 'ri-markdown-line',
  markdown: 'ri-markdown-line',
  json: 'ri-file-code-line',
}

const getFileIconClass = (file: IFile) => {
  const ext = file.ext
  if (ext && extFileIconClassMap[ext]) {
    return extFileIconClassMap[ext]
  }
  return 'ri-file-line'
}

function FileNode({
  style,
  node,
  dragHandle,
  tree,
  getCurrentFolderData,
  setFolderData,
  isRoot = false,
  onShowConfirm,
  onShowInputConfirm,
  onShowContextMenu,
  getFileObject,
  getFileObjectByPath,
  createFile,
  updateFile,
  deletePathEntry,
  getFileIdsByPathPrefix,
  setFileObject,
  setFileObjectByPath,
  moveFileObjectsByPathPrefix,
  deleteFileObjectsByPathPrefix,
  fileTreeHandler,
  disableFileOperations = false,
  iconButtonComponent: IconButton,
}: FileNodeComponentProps) {
  const indentSize = Number.parseFloat(`${style.paddingLeft || 0}`)
  const { deleteNode, trashNode, activeId, refreshFolder, closeAll, scrollTo } = useFileTree()
  const {
    runFileMutation,
    renameFile,
    copyFile,
    createFolder,
    writeFile,
    fileExists,
    revealInFolder,
  } = useFileSystem()

  const delFileHandler = () => {
    const target = captureFileMutationTarget(node.data)
    if (!target) return Promise.resolve()

    return runFileMutation(async (lease) => {
      const mutationTree = new SimpleTree(getCurrentFolderData())
      const currentNode = getCurrentFileMutationNode(mutationTree, getFileObject, target)
      if (!currentNode) return
      const protection = collectFileMutationProtection(
        [currentNode.data],
        getFileObject,
        getFileIdsByPathPrefix,
      )
      lease.protectFileIds(protection.fileIds)
      lease.protectPaths(protection.paths)

      await deleteNode(currentNode.data)
      mutationTree.drop({ id: target.id })
      if (deleteFileObjectsByPathPrefix) {
        deleteFileObjectsByPathPrefix(target.path)
      } else {
        deletePathEntry?.(target.path)
      }
      setFolderData(mutationTree.data)
    })
  }

  const isPending =
    node.data.kind === 'pending_new_file' ||
    node.data.kind === 'pending_new_folder' ||
    node.data.kind === 'pending_edit_folder' ||
    node.data.kind === 'pending_edit_file'

  const inputType =
    node.data.kind === 'pending_new_folder' || node.data.kind === 'pending_edit_folder'
      ? 'dir'
      : 'file'
  const isUpdate =
    node.data.kind === 'pending_edit_folder' || node.data.kind === 'pending_edit_file'

  const createFileHandler = async (file: IFile) => {
    const pendingId = node.id
    const pendingKind = node.data.kind
    const parentTarget = node.parent ? captureFileMutationTarget(node.parent.data) : undefined
    if (!file.path || !parentTarget) return

    await runFileMutation(async () => {
      const mutationTree = new SimpleTree(getCurrentFolderData())
      const pendingNode = mutationTree.find(pendingId)
      const currentParent = getCurrentFileMutationNode(mutationTree, getFileObject, parentTarget)
      if (!pendingNode || pendingNode.data.kind !== pendingKind || !currentParent) return

      if (await fileExists(file.path!)) {
        toast.error('File already exists')
        return
      }

      if (inputType === 'dir') {
        await createFolder(file.path!)
      } else {
        await writeFile(file.path!, '')
      }

      const targetFile = createFile
        ? createFile({
            path: file.path,
            name: file.name,
            content: '',
            id: pendingId,
            kind: file.kind,
          })
        : { ...file, content: '' }

      mutationTree.update({
        id: pendingId,
        changes: { ...pendingNode.data, ...targetFile },
      })
      setFolderData(mutationTree.data)
    })
  }

  const renameFileHandler = async (file: IFile) => {
    const target = captureFileMutationTarget(node.data)
    const nextPath = file.path
    if (!target || !nextPath) return

    await runFileMutation(async (lease) => {
      const mutationTree = new SimpleTree(getCurrentFolderData())
      const currentNode = getCurrentFileMutationNode(mutationTree, getFileObject, target)
      if (!currentNode) return
      const protection = collectFileMutationProtection(
        [currentNode.data],
        getFileObject,
        getFileIdsByPathPrefix,
      )
      lease.protectFileIds(protection.fileIds)
      lease.protectPaths(protection.paths)
      lease.protectPaths([nextPath])

      if (target.path !== nextPath && (await fileExists(nextPath))) {
        toast.error('File already exists')
        return
      }

      const moveFileInfo = await renameFile(target.path, nextPath)

      moveFileNode(
        mutationTree,
        moveFileInfo,
        getFileObject,
        getFileObjectByPath,
        deletePathEntry,
        setFileObjectByPath,
        setFileObject,
        moveFileObjectsByPathPrefix,
        deleteFileObjectsByPathPrefix,
      )
      fileTreeHandler?.clearLoadedDirsCache?.()

      if (updateFile) {
        updateFile({
          path: nextPath,
          name: file.name,
          id: target.id,
          kind: file.kind,
        })
      }

      mutationTree.update({
        id: target.id,
        changes: { kind: file.kind, name: file.name },
      })
      setFolderData(mutationTree.data)
    })
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (disableFileOperations) return

    const items: ContextMenuItem[] = []

    if (node.parent) {
      items.push(
        {
          label: 'New File',
          value: 'new_file',
          handler: () => {
            if (node.parent) {
              const mutationTree = new SimpleTree(getCurrentFolderData())
              const parentData = node.isInternal ? node.data : node.parent.data
              const parentTarget = captureFileMutationTarget(parentData)
              if (
                !parentTarget ||
                !getCurrentFileMutationNode(mutationTree, getFileObject, parentTarget)
              ) {
                return
              }

              const data = {
                id: `pending-${Date.now()}`,
                name: '',
                kind: 'pending_new_file',
              } as IFile
              if (node.isInternal) {
                node.open()
              }

              mutationTree.create({
                parentId: parentTarget.id,
                data,
              })
              setFolderData(mutationTree.data)
            }
          },
        },
        {
          label: 'New Folder',
          value: 'new_folder',
          handler: () => {
            if (node.parent) {
              const mutationTree = new SimpleTree(getCurrentFolderData())
              const parentData = node.isInternal ? node.data : node.parent.data
              const parentTarget = captureFileMutationTarget(parentData)
              if (
                !parentTarget ||
                !getCurrentFileMutationNode(mutationTree, getFileObject, parentTarget)
              ) {
                return
              }

              const data = {
                id: `pending-${Date.now()}`,
                name: '',
                kind: 'pending_new_folder',
                children: [],
              } as IFile
              if (node.isInternal) {
                node.open()
              }

              mutationTree.create({
                parentId: parentTarget.id,
                data,
              })
              setFolderData(mutationTree.data)
            }
          },
        },
      )
    }

    if (node.data.kind === 'dir' || node.data.ext === 'md') {
      items.push({
        label: 'Rename',
        value: 'rename',
        handler: () => {
          const target = captureFileMutationTarget(node.data)
          if (node.parent && target) {
            const mutationTree = new SimpleTree(getCurrentFolderData())
            const currentNode = getCurrentFileMutationNode(mutationTree, getFileObject, target)
            if (!currentNode) return

            mutationTree.update({
              id: target.id,
              changes: {
                kind: currentNode.data.kind === 'dir' ? 'pending_edit_folder' : 'pending_edit_file',
              },
            })
            setFolderData(mutationTree.data)
          }
        },
      })
    }

    items.push({
      value: node.data.kind === 'dir' ? 'delete_folder' : 'delete_file',
      label: node.data.kind === 'dir' ? 'Delete Folder' : 'Delete File',
      handler: () => {
        onShowConfirm({
          title: `Are you sure you want to delete ${node.data.name}?`,
          onConfirm: delFileHandler,
        })
      },
    })

    if (node.data.kind === 'file') {
      items.push({
        value: 'copy',
        label: 'Copy',
        handler: () => {
          const target = captureFileMutationTarget(node.data)
          const parentTarget = node.parent ? captureFileMutationTarget(node.parent.data) : undefined
          if (!target || !parentTarget) return

          void runFileMutation(async (lease) => {
            const mutationTree = new SimpleTree(getCurrentFolderData())
            const currentNode = getCurrentFileMutationNode(mutationTree, getFileObject, target)
            const currentParent = getCurrentFileMutationNode(
              mutationTree,
              getFileObject,
              parentTarget,
            )
            if (!currentNode || !currentParent) return
            const protection = collectFileMutationProtection(
              [currentNode.data],
              getFileObject,
              getFileIdsByPathPrefix,
            )
            lease.protectFileIds(protection.fileIds)
            lease.protectPaths(protection.paths)

            const targetPath = await copyFile(target.path)
            if (targetPath) {
              const file = createFile
                ? createFile({
                    name: getFileNameFromPath(targetPath),
                    path: targetPath,
                  })
                : ({
                    name: getFileNameFromPath(targetPath),
                    path: targetPath,
                    kind: 'file',
                  } as IFile)

              mutationTree.create({
                parentId: parentTarget.id,
                data: file,
                index: currentNode.childIndex,
              })
              setFolderData(mutationTree.data)
            }
          })
        },
      })
    }

    items.push({
      value: 'trash',
      label: 'Move to Trash',
      handler: () => {
        onShowConfirm({
          title: `Are you sure you want to move ${node.data.name} to trash?`,
          onConfirm: () => {
            const target = captureFileMutationTarget(node.data)
            if (!target) return

            void runFileMutation(async (lease) => {
              const mutationTree = new SimpleTree(getCurrentFolderData())
              const currentNode = getCurrentFileMutationNode(mutationTree, getFileObject, target)
              if (!currentNode) return
              const protection = collectFileMutationProtection(
                [currentNode.data],
                getFileObject,
                getFileIdsByPathPrefix,
              )
              lease.protectFileIds(protection.fileIds)
              lease.protectPaths(protection.paths)

              await trashNode(currentNode.data)
              mutationTree.drop({ id: target.id })
              if (deleteFileObjectsByPathPrefix) {
                deleteFileObjectsByPathPrefix(target.path)
              } else {
                deletePathEntry?.(target.path)
              }
              setFolderData(mutationTree.data)
            })
          },
        })
      },
    })

    if (revealInFolder) {
      items.push({
        value: 'show_in_folder',
        label: 'Show in Folder',
        handler: async () => {
          try {
            const exists = await fileExists(node.data.path!)
            if (!exists || !node.data.path) {
              toast.error('File not found')
              return
            }
            await revealInFolder(node.data.path)
          } catch (error) {
            console.error('Failed to show in folder:', error)
          }
        },
      })
    }

    onShowContextMenu({
      x: e.clientX,
      y: e.clientY,
      items,
    })
  }

  return (
    <NodeContainer
      style={style}
      highlight={
        !!(
          tree.dragDestinationParent?.isAncestorOf(node) &&
          tree.dragDestinationParent?.id !== tree.dragNode?.parent?.id
        )
      }
      selected={activeId === node.id}
      onContextMenu={handleContextMenu}
      onClick={(e) => {
        if (isPending) {
          e.stopPropagation()
          return
        }
        if (e.shiftKey) {
          return
        }
        if (node.data.kind === 'dir') {
          node.toggle()
        }
      }}
      onMouseUp={(e) => {
        if (isPending) {
          e.stopPropagation()
        }
      }}
      ref={isPending ? null : dragHandle}
    >
      <div style={{ display: 'flex', padding: '0 6px', width: '100%', boxSizing: 'border-box' }}>
        <div className='indentLines'>
          {new Array(indentSize / 16).fill(0).map((_, index) => {
            return <div key={index}></div>
          })}
        </div>
        {isPending ? (
          <NewFileInput
            style={{ paddingTop: 0, paddingBottom: 0 }}
            fileNode={node.data}
            inputType={inputType}
            parentNode={node.parent?.data}
            onCreate={async (file) => {
              if (isUpdate) {
                await renameFileHandler(file)
              } else {
                await createFileHandler(file)
              }
            }}
            onCancel={(fileInfo) => {
              const cancelInput = () => {
                const mutationTree = new SimpleTree(getCurrentFolderData())
                const pendingNode = mutationTree.find(node.id)
                if (!pendingNode) return

                if (isUpdate) {
                  mutationTree.update({
                    id: node.id,
                    changes: {
                      kind: pendingNode.data.kind === 'pending_edit_folder' ? 'dir' : 'file',
                    },
                  })
                } else {
                  mutationTree.drop({ id: node.id })
                }

                setFolderData(mutationTree.data)
              }

              if (!fileInfo) {
                cancelInput()
                return
              }

              if (onShowInputConfirm) {
                onShowInputConfirm({
                  title: 'Save changes?',
                  confirmText: 'Save',
                  cancelText: 'Discard',
                  onConfirm: async () => {
                    if (isUpdate) {
                      await renameFileHandler(fileInfo)
                    } else {
                      await createFileHandler(fileInfo)
                    }
                  },
                  onClose: () => {
                    cancelInput()
                  },
                })
              } else {
                cancelInput()
              }
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              {node.data?.kind === 'dir' ? (
                <i
                  className={`${node.isOpen ? 'ri-folder-5-fill' : 'ri-folder-3-fill'} file-icon`}
                />
              ) : (
                <i className={`${getFileIconClass(node.data)} file-icon`} />
              )}
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {node.data.name}
              </span>
            </div>

            {isRoot && IconButton ? (
              <div style={{ display: 'flex', gap: '2px' }}>
                <IconButton
                  size='small'
                  rounded='smooth'
                  icon={'ri-refresh-line'}
                  onClick={async (e?: React.MouseEvent) => {
                    e?.stopPropagation()
                    e?.preventDefault()
                    await refreshFolder()
                  }}
                  tooltipProps={{ title: 'Refresh' }}
                />
                <IconButton
                  size='small'
                  rounded='smooth'
                  icon={'ri-focus-3-line'}
                  onClick={(e?: React.MouseEvent) => {
                    e?.stopPropagation()
                    e?.preventDefault()
                    if (activeId && scrollTo) {
                      scrollTo(activeId)
                    }
                  }}
                  tooltipProps={{ title: 'Focus Active File' }}
                />
                <IconButton
                  size='small'
                  rounded='smooth'
                  icon={'ri-collapse-vertical-fill'}
                  onClick={(e?: React.MouseEvent) => {
                    e?.stopPropagation()
                    e?.preventDefault()
                    if (closeAll) {
                      closeAll()
                    }
                    node.open()
                  }}
                  tooltipProps={{ title: 'Collapse All' }}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </NodeContainer>
  )
}

export default FileNode
