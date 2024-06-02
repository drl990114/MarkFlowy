import { IFile } from '@/helper/filesys'
import { SimpleTree } from './SimpleTree'
import { getFileObject, getFileObjectByPath, pathEntries } from '@/helper/files'

export const updateFileNodePath = (tree: SimpleTree<IFile>, params: Partial<IFile>) => {
  const { id, ...rest } = params
  if (!id) {
    return
  }

  const file = getFileObject(id)

  if (file && file.path) {
    tree.update({ id, changes: rest })

    if (rest.path) {
      delete pathEntries[file.path]
      file.path = rest.path
      pathEntries[rest.path] = file
    }
  }
}

export type MoveFileInfo = {
  old_path: string
  new_path: string
  children: IFile[]
  is_folder: boolean
  is_replaced?: boolean
}

export const moveFileNode = async (tree: SimpleTree<IFile>, moveFileInfo: MoveFileInfo) => {
  const oldFile = getFileObjectByPath(moveFileInfo.old_path)
  const oldFileNode = tree.find(oldFile.id)

  if (moveFileInfo.is_replaced) {
    tree.drop({ id: oldFile.id })
  } else if (moveFileInfo.is_folder) {
    const dep = (fileNode: IFile, newPath: string, children: IFile[]) => {
      updateFileNodePath(tree, {
        id: fileNode.id,
        path: newPath,
      })

      fileNode.children?.forEach((child) => {
        const newChild = children.find((c) => c.name === child.name)
        if (!newChild) {
          return
        }

        if (child.kind === 'dir') {
          dep(child, newChild.path!, newChild.children!)
        } else {
          updateFileNodePath(tree, {
            id: child.id,
            path: newChild.path!,
          })
        }
      })
    }
    dep(oldFileNode!.data, moveFileInfo.new_path, moveFileInfo.children)
  } else {
    updateFileNodePath(tree, {
      id: oldFile.id,
      path: moveFileInfo.new_path,
    })
  }
}
