import type { IFile } from '../../types/file'
import type { MoveFileInfo } from '../../contexts/FileSystemContext'
import type { SimpleTree } from './types'

export interface MoveFileNodeOptions {
  deleteFileObjectsByIds?: (fileIds: string[]) => void
  replacementIds?: string[]
}

/** Use the adapter's directory order without replacing live nodes or loaded subtrees. */
export function mergeDirectoryChildren(current: IFile[], entries: IFile[]): IFile[] {
  const byId = new Map(current.map((child) => [child.id, child]))
  const byPath = new Map(current.filter((child) => child.path).map((child) => [child.path, child]))
  const matchedIds = new Set<string>()
  const ordered = entries.map((entry) => {
    const child = (entry.path && byPath.get(entry.path)) || byId.get(entry.id) || entry
    matchedIds.add(child.id)
    return child
  })

  // Keep drafts and concurrent creations in their existing slots while the
  // on-disk entries follow the read order. Both passes are linear in sibling count.
  const merged: IFile[] = []
  let next = 0
  for (const child of current) {
    if (!matchedIds.has(child.id)) merged.push(child)
    else if (next < ordered.length) merged.push(ordered[next++])
  }
  while (next < ordered.length) merged.push(ordered[next++])
  return merged.length === current.length && merged.every((child, index) => child === current[index])
    ? current
    : merged
}

export const updateFileNodePath = (
  tree: SimpleTree<IFile>,
  params: Partial<IFile> & { id: string },
) => {
  const { id, ...rest } = params
  if (!id) {
    return
  }

  tree.update({ id, changes: rest })
}

export const moveFileNode = (
  tree: SimpleTree<IFile>,
  moveFileInfo: MoveFileInfo,
  getFileObject: (id: string) => IFile | undefined,
  getFileObjectByPath: (path: string) => IFile | undefined,
  deletePathEntry?: (path: string) => void,
  setFileObjectByPath?: (path: string, file: IFile) => void,
  setFileObject?: (id: string, file: IFile) => void,
  moveFileObjectsByPathPrefix?: (oldRootPath: string, newRootPath: string) => void,
  deleteFileObjectsByPathPrefix?: (rootPath: string) => void,
  options: MoveFileNodeOptions = {},
) => {
  const oldFile = getFileObjectByPath(moveFileInfo.old_path)
  const nodes = [tree.root]
  let oldFileNode = oldFile ? tree.find(oldFile.id) : null
  while (!oldFileNode && nodes.length > 0) {
    const node = nodes.pop()!
    if (node.data.path === moveFileInfo.old_path) {
      oldFileNode = node
      break
    }
    if (node.children) nodes.push(...node.children)
  }

  if (moveFileInfo.is_replaced) {
    const replacementIds = new Set(options.replacementIds ?? [])
    if (oldFileNode) replacementIds.add(oldFileNode.id)

    if (replacementIds.size > 0) {
      replacementIds.forEach((id) => tree.drop({ id }))
      if (options.deleteFileObjectsByIds) {
        options.deleteFileObjectsByIds([...replacementIds])
      } else if (deleteFileObjectsByPathPrefix) {
        deleteFileObjectsByPathPrefix(moveFileInfo.old_path)
      } else if (deletePathEntry) {
        deletePathEntry(moveFileInfo.old_path)
      }
    } else if (deleteFileObjectsByPathPrefix) {
      deleteFileObjectsByPathPrefix(moveFileInfo.old_path)
    } else if (deletePathEntry) {
      deletePathEntry(moveFileInfo.old_path)
    }
    return
  }

  const sourceFile = oldFile ?? oldFileNode?.data
  if (!sourceFile) {
    throw new Error(`File not found for path: ${moveFileInfo.old_path}`)
  }

  const updateCachedFilePath = (fileNode: IFile, path: string) => {
    const cachedFile = getFileObject(fileNode.id)
    const nextFile = { ...fileNode, ...cachedFile, path }

    setFileObjectByPath?.(path, nextFile)
    setFileObject?.(fileNode.id, nextFile)
  }

  if (moveFileInfo.is_folder) {
    const rebasePath = (path: string | undefined) => {
      if (!path) return undefined
      if (path === moveFileInfo.old_path) return moveFileInfo.new_path
      if (!path.startsWith(moveFileInfo.old_path)) return undefined

      const separator = path.charAt(moveFileInfo.old_path.length)
      if (separator !== '/' && separator !== '\\') return undefined

      return `${moveFileInfo.new_path}${path.slice(moveFileInfo.old_path.length)}`
    }

    const updateDescendantPaths = (fileNode: IFile) => {
      const oldPath = fileNode.path
      const newPath = rebasePath(oldPath)
      if (!newPath) return

      updateFileNodePath(tree, {
        id: fileNode.id,
        path: newPath,
      })

      if (!moveFileObjectsByPathPrefix || !getFileObject(fileNode.id)) {
        if (oldPath && deletePathEntry) {
          deletePathEntry(oldPath)
        }
        updateCachedFilePath(fileNode, newPath)
      }

      fileNode.children?.forEach(updateDescendantPaths)
    }

    if (oldFileNode) {
      updateDescendantPaths(oldFileNode.data)
    }
    moveFileObjectsByPathPrefix?.(moveFileInfo.old_path, moveFileInfo.new_path)
  } else {
    updateFileNodePath(tree, {
      id: sourceFile.id,
      path: moveFileInfo.new_path,
    })
    if (moveFileObjectsByPathPrefix) {
      const sourceWasCached = Boolean(getFileObject(sourceFile.id))
      moveFileObjectsByPathPrefix(moveFileInfo.old_path, moveFileInfo.new_path)
      if (!sourceWasCached) {
        updateCachedFilePath(sourceFile, moveFileInfo.new_path)
      }
    } else {
      if (deletePathEntry) {
        deletePathEntry(moveFileInfo.old_path)
      }
      updateCachedFilePath(sourceFile, moveFileInfo.new_path)
    }
  }
}
