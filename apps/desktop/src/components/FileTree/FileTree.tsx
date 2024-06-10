import type { FC } from 'react'
import { memo, useMemo } from 'react'
import FileNode from './FileNode'
import { type IFile } from '@/helper/filesys'
import { Tree } from 'react-arborist'
import { TreeProps } from 'react-arborist/dist/module/types/tree-props'
import { useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { FillFlexParent } from '../fill-flex-parent'
import { SimpleTree } from './SimpleTree'
import NiceModal from '@ebay/nice-modal-react'
import { MODAL_CONFIRM_ID } from '../Modal'
import { useTranslation } from 'react-i18next'
import { moveFileNode } from './file-operator'

const FileTree: FC<FileTreeProps> = (props) => {
  const { data, onSelect } = props
  const { activeId, setFolderData } = useEditorStore()
  const { t } = useTranslation()
  const tree = useMemo(() => new SimpleTree<IFile>(data), [data])

  if (data === null) return null

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
          res.forEach((moveFileInfo) => {
            moveFileNode(tree, moveFileInfo)
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
          // FIXME https://github.com/tauri-apps/tauri/issues/9966
          disableDrag
          disableDrop
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
