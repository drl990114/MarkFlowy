import type { IFile } from '../../types/file'
import type { MoveFileInfo } from '../../contexts/FileSystemContext'
import type { SimpleTree } from './types'

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

export const moveFileNode = async (
  tree: SimpleTree<IFile>,
  moveFileInfo: MoveFileInfo,
  _getFileObject: (id: string) => IFile | undefined,
  getFileObjectByPath: (path: string) => IFile | undefined,
  deletePathEntry?: (path: string) => void,
  setFileObjectByPath?: (path: string, file: IFile) => void,
  setFileObject?: (id: string, file: IFile) => void,
) => {
  const oldFile = getFileObjectByPath(moveFileInfo.old_path)

  if (!oldFile) {
    throw new Error(`File not found for path: ${moveFileInfo.old_path}`)
  }

  const oldFileNode = tree.find(oldFile.id)

  if (moveFileInfo.is_replaced) {
    tree.drop({ id: oldFile.id })
    // 删除旧的 path 映射
    if (deletePathEntry) {
      deletePathEntry(moveFileInfo.old_path)
    }
  } else if (moveFileInfo.is_folder) {
    const dep = (fileNode: IFile, newPath: string, children: IFile[]) => {
      const oldPath = fileNode.path
      
      updateFileNodePath(tree, {
        id: fileNode.id,
        path: newPath,
      })

      // 更新 pathEntries 映射
      if (oldPath && deletePathEntry) {
        deletePathEntry(oldPath)
      }
      if (setFileObjectByPath) {
        setFileObjectByPath(newPath, { ...fileNode, path: newPath })
      }
      // 更新 entries 映射（editor 使用 getFileObject 获取文件）
      if (setFileObject) {
        setFileObject(fileNode.id, { ...fileNode, path: newPath })
      }

      fileNode.children?.forEach((child) => {
        const newChild = children.find((c) => c.name === child.name)
        if (!newChild) {
          return
        }

        if (child.kind === 'dir') {
          dep(child, newChild.path!, newChild.children!)
        } else {
          const childOldPath = child.path
          updateFileNodePath(tree, {
            id: child.id,
            path: newChild.path!,
          })
          // 更新子文件的 pathEntries 映射
          if (childOldPath && deletePathEntry) {
            deletePathEntry(childOldPath)
          }
          if (setFileObjectByPath) {
            setFileObjectByPath(newChild.path!, { ...child, path: newChild.path! })
          }
          // 更新子文件的 entries 映射
          if (setFileObject) {
            setFileObject(child.id, { ...child, path: newChild.path! })
          }
        }
      })
    }
    if (oldFileNode) {
      dep(oldFileNode.data, moveFileInfo.new_path, moveFileInfo.children)
    }
  } else {
    updateFileNodePath(tree, {
      id: oldFile.id,
      path: moveFileInfo.new_path,
    })
    // 更新 pathEntries 映射
    if (deletePathEntry) {
      deletePathEntry(moveFileInfo.old_path)
    }
    if (setFileObjectByPath) {
      setFileObjectByPath(moveFileInfo.new_path, { ...oldFile, path: moveFileInfo.new_path })
    }
    // 更新 entries 映射（editor 使用 getFileObject 获取文件）
    if (setFileObject) {
      setFileObject(oldFile.id, { ...oldFile, path: moveFileInfo.new_path })
    }
  }
}
