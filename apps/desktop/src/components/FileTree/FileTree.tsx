import type { FC } from 'react'
import { memo, useMemo } from 'react'
import FileNode from './FileNode'
import { type IFile } from '@/helper/filesys'
import { Tree } from 'react-arborist'
import { TreeProps } from 'react-arborist/dist/module/types/tree-props'
import { useEditorStore } from '@/stores'
import { getFileObject, getFileObjectByPath, pathEntries } from '@/helper/files'
import { invoke } from '@tauri-apps/api/core'
import { FillFlexParent } from '../fill-flex-parent'
import { SimpleTree } from './SimpleTree'
import NiceModal from '@ebay/nice-modal-react'
import { MODAL_CONFIRM_ID } from '../Modal'
import { useTranslation } from 'react-i18next'

const FileTree: FC<FileTreeProps> = (props) => {
  const { data, onSelect } = props
  const { activeId, setFolderData } = useEditorStore()
  const { t } = useTranslation()
  const tree = useMemo(() => new SimpleTree<IFile>(data), [data])

  if (data === null) return null

  const updateFileNodePath = (id: string, newPath: string) => {
    const file = getFileObject(id)

    if (file && file.path !== newPath && file.path) {
      delete pathEntries[file.path]

      tree.update({ id, changes: { ...file, path: newPath } })
      file.path = newPath
      pathEntries[newPath] = file
    }
  }

  const onMove: TreeProps<IFile>['onMove'] = async (args) => {
    const _dragNodes = args.dragNodes.filter((node) => {
      return !args.dragIds.includes(node.parent?.id || '')
    })
    // current only can move one file
    const _dragNode = _dragNodes[0]
    const parentNode = args.parentNode

    if (!parentNode) {
      return
    }
    const targetPath = await invoke<string>('path_join', {
      path1: parentNode.data.path,
      path2: _dragNode.data.name,
    })
    const isExist = await invoke<boolean>('file_exists', { filePath: targetPath })

    if (isExist) {
      NiceModal.show(MODAL_CONFIRM_ID, {
        title: t('confirm.replace.description', {
          name: _dragNode.data.name,
        }),
        onConfirm: () => move(true),
      })
    } else {
      NiceModal.show(MODAL_CONFIRM_ID, {
        title: t('confirm.move.description', {
          name: _dragNode.data.name,
        }),
        onConfirm: () => move(),
      })
    }
    const move = (replace = false) => {
      invoke('move_files_to_target_folder', {
        files: _dragNodes.map((node) => node.data.path),
        targetFolder: parentNode.data.path,
        replaceExist: replace,
      }).then((res) => {
        if (Array.isArray(res)) {
          res.forEach((oldToNew) => {
            const oldFile = getFileObjectByPath(oldToNew.old_path)
            const oldFileNode = tree.find(oldFile.id)

            if (oldToNew.is_replaced) {
              tree.drop({ id: oldFile.id })
            } else if (oldToNew.is_folder) {
              const dep = (fileNode: IFile, newPath: string, children: IFile[]) => {
                updateFileNodePath(fileNode.id, newPath)

                fileNode.children?.forEach((child, index) => {
                  if (child.kind === 'dir') {
                    if (children[index]) {
                      dep(child, children[index].path!, children[index].children!)
                    }
                  } else {
                    updateFileNodePath(child.id, children[index].path!)
                  }
                })
              }

              dep(oldFileNode!.data, oldToNew.new_path, oldToNew.children)
            } else {
              updateFileNodePath(oldFile.id, oldToNew.new_path)
            }
          })

          const _dragIds = _dragNodes.map((node) => node.data.id)
          for (const id of _dragIds) {
            tree.move({ id, parentId: args.parentId, index: args.index })
          }
          setFolderData(tree.data)
        }
      })
    }
  }

  return (
    <FillFlexParent>
      {(dimens) => (
        <Tree
          {...dimens}
          data={data}
          openByDefault={false}
          initialOpenState={{
            [data[0]?.id]: true,
          }}
          selection={activeId}
          indent={16}
          disableMultiSelection
          onSelect={(node) => onSelect(node[0]?.data)}
          onMove={onMove}
        >
          {(props) => FileNode({ ...props, simpleTree: tree, setFolderData })}
        </Tree>
      )}
    </FillFlexParent>
  )
}

interface FileTreeProps extends BaseComponentProps {
  data: IFile[]
  activeId?: string
  onSelect: (file: IFile) => void
}

export default memo(FileTree)
