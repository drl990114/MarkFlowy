import type { FileSystemContextValue } from '../../contexts/FileSystemContext'
import type { IFile } from '../../types/file'
import {
  captureFileMutationTarget,
  collectFileMutationProtection,
  getCurrentFileMutationNodeInRoot,
  type FileMutationTarget,
} from './file-mutation'
import { SimpleTree, type SimpleNode } from './types'
import { getFileNameFromPath } from './verify-file-name'

export interface CopyFileTreeNodeOptions {
  source: FileMutationTarget
  parent: FileMutationTarget
  root: FileMutationTarget
  mode: 'duplicate' | 'copy-to'
  fileSystem: Pick<FileSystemContextValue, 'runFileMutation' | 'copyFile' | 'selectCopyDirectory'>
  getCurrentFolderData: () => IFile[]
  setFolderData: (data: IFile[]) => void
  getFileObject: (id: string) => IFile | undefined
  getFileObjectByPath: (path: string) => IFile | undefined
  getFileIdsByPathPrefix?: (path: string) => string[]
  createFile?: (options: Partial<IFile>) => IFile
  canInsertIntoDirectory: (directory: IFile) => boolean
}

function directoryPathKey(path: string): string {
  const windows = /^[a-z]:[\\/]/i.test(path) || path.startsWith('\\\\')
  const normalized = windows ? path.replace(/\\/g, '/') : path
  return normalized.replace(/\/+$/, '') || '/'
}

export function getCopyParentPath(path: string): string {
  const separator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  const rootLength = /^[a-z]:[\\/]/i.test(path) ? 3 : 1
  return path.slice(0, Math.max(separator, rootLength))
}

function findDirectory(
  tree: SimpleTree<IFile>,
  path: string,
  getFileObjectByPath: CopyFileTreeNodeOptions['getFileObjectByPath'],
): SimpleNode<IFile> | undefined {
  const cached = getFileObjectByPath(path)
  const cachedNode = cached ? tree.find(cached.id) : undefined
  if (cachedNode?.data.kind === 'dir' && cachedNode.data.path === path) return cachedNode

  const key = directoryPathKey(path)
  const pending = [...(tree.root.children ?? [])]
  while (pending.length) {
    const node = pending.pop()!
    if (node.data.kind !== 'dir') continue
    if (node.data.path && directoryPathKey(node.data.path) === key) return node
    pending.push(...(node.children ?? []))
  }
  return undefined
}

/** The picker never holds a mutation lease or suppresses editor autosave. */
export async function copyFileTreeNode(options: CopyFileTreeNodeOptions): Promise<string | null> {
  const { fileSystem, source, parent, root, getFileObject, getFileObjectByPath } = options
  let targetFolder: string | undefined
  if (options.mode === 'copy-to') {
    const selected = await fileSystem.selectCopyDirectory?.(source.path)
    if (!selected) return null
    targetFolder = selected
  }

  return fileSystem.runFileMutation(async (lease) => {
    const currentTree = () => {
      const data = options.getCurrentFolderData()
      return data[0]?.id === root.id && data[0]?.path === root.path ? new SimpleTree(data) : null
    }
    const tree = currentTree()
    if (!tree) return null
    const sourceNode = getCurrentFileMutationNodeInRoot(tree, getFileObject, source, root.id)
    const parentNode = getCurrentFileMutationNodeInRoot(tree, getFileObject, parent, root.id)
    if (sourceNode?.data.kind !== 'file' || parentNode?.data.kind !== 'dir') return null

    const directory = targetFolder
      ? findDirectory(tree, targetFolder, getFileObjectByPath)
      : parentNode
    const directoryTarget = directory ? captureFileMutationTarget(directory.data) : undefined
    const protection = collectFileMutationProtection(
      [sourceNode.data],
      getFileObject,
      options.getFileIdsByPathPrefix,
    )
    lease.protectFileIds([...protection.fileIds, ...(directoryTarget ? [directoryTarget.id] : [])])
    lease.protectPaths([...protection.paths, targetFolder ?? parent.path])

    const copiedPath = await fileSystem.copyFile(
      source.path,
      targetFolder ? (directory?.data.path ?? targetFolder) : undefined,
    )
    // Re-read after I/O: workspace changes, lazy loads and inline drafts may have
    // updated the tree while the backend was copying the saved file.
    const nextTree = currentTree()
    if (!nextTree || !directoryTarget) return copiedPath
    const nextDirectory = getCurrentFileMutationNodeInRoot(
      nextTree,
      getFileObject,
      directoryTarget,
      root.id,
    )
    if (nextDirectory?.data.kind !== 'dir' || !options.canInsertIntoDirectory(nextDirectory.data)) {
      // Inserting a single child into an unloaded directory would make its
      // remaining children look loaded. Let the normal directory read find it.
      return copiedPath
    }
    if (nextDirectory.data.children?.some((child) => child.path === copiedPath)) return copiedPath

    const name = getFileNameFromPath(copiedPath)
    const fileOptions: Partial<IFile> = {
      name,
      path: copiedPath,
      kind: 'file',
      ext: sourceNode.data.ext,
      content: undefined,
    }
    const file = options.createFile
      ? options.createFile(fileOptions)
      : ({ ...fileOptions, id: crypto.randomUUID() } as IFile)
    const sourceIndex = nextDirectory.children?.findIndex((child) => child.id === source.id) ?? -1
    nextTree.create({
      parentId: nextDirectory.id,
      data: file,
      index: sourceIndex >= 0 ? sourceIndex + 1 : (nextDirectory.children?.length ?? 0),
    })
    options.setFolderData(nextTree.data)
    return copiedPath
  })
}
