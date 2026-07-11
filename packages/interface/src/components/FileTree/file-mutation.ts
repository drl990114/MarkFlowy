import type { IFile } from '../../types/file'
import type { SimpleNode, SimpleTree } from './types'

export interface FileMutationTarget {
  id: string
  path: string
}

export interface FileMutationProtection {
  fileIds: string[]
  paths: string[]
}

export const captureFileMutationTarget = (file: IFile): FileMutationTarget | undefined => {
  if (!file.path) return undefined
  return { id: file.id, path: file.path }
}

/**
 * Revalidates a queued mutation against both the latest tree and the shared file cache.
 * A Save As replacement removes the old id from both, so stale closures become safe no-ops.
 */
export const getCurrentFileMutationNode = (
  tree: SimpleTree<IFile>,
  getFileObject: (id: string) => IFile | undefined,
  target: FileMutationTarget,
): SimpleNode<IFile> | undefined => {
  const cachedFile = getFileObject(target.id)
  if (cachedFile?.id !== target.id || cachedFile.path !== target.path) return undefined

  const currentNode = tree.find(target.id)
  if (currentNode?.data.id !== target.id || currentNode.data.path !== target.path) return undefined
  return currentNode
}

export const getCurrentFileMutationNodes = (
  tree: SimpleTree<IFile>,
  getFileObject: (id: string) => IFile | undefined,
  targets: FileMutationTarget[],
): SimpleNode<IFile>[] | undefined => {
  const nodes = targets.map((target) => getCurrentFileMutationNode(tree, getFileObject, target))
  if (nodes.some((node) => !node)) return undefined
  return nodes as SimpleNode<IFile>[]
}

export const getCurrentFileMutationNodeInRoot = (
  tree: SimpleTree<IFile>,
  getFileObject: (id: string) => IFile | undefined,
  target: FileMutationTarget,
  rootId: string,
): SimpleNode<IFile> | undefined => {
  if (tree.data[0]?.id !== rootId) return undefined
  return getCurrentFileMutationNode(tree, getFileObject, target)
}

export const collectFileMutationProtection = (
  files: IFile[],
  getFileObject: (id: string) => IFile | undefined,
  getFileIdsByPathPrefix?: (path: string) => string[],
): FileMutationProtection => {
  const fileIds = new Set<string>()
  const paths = new Set<string>()
  const visit = (file: IFile) => {
    fileIds.add(file.id)
    if (file.path) {
      paths.add(file.path)
      getFileIdsByPathPrefix?.(file.path).forEach((id) => fileIds.add(id))
    }
    file.children?.forEach(visit)
  }
  files.forEach(visit)
  fileIds.forEach((id) => {
    const path = getFileObject(id)?.path
    if (path) paths.add(path)
  })
  return { fileIds: [...fileIds], paths: [...paths] }
}
