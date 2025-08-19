import { type IFile } from '@/helper/filesys'
import { useEditorStore } from '@/stores'
import NiceModal from '@ebay/nice-modal-react'
import { invoke } from '@tauri-apps/api/core'
import type { FC } from 'react'
import { memo, useDeferredValue, useMemo } from 'react'
import { Tree, TreeApi } from 'react-arborist'
import { TreeProps } from 'react-arborist/dist/module/types/tree-props'
import { useTranslation } from 'react-i18next'
import { FillFlexParent } from '../fill-flex-parent'
import { MODAL_CONFIRM_ID } from '../Modal'
import { moveFileNode } from './file-operator'
import FileNode from './FileNode'
import { SimpleTree } from './SimpleTree'

export const fileTreeHandler: {
  rootTree: undefined | TreeApi<IFile>
  updateTreeView: undefined | ((params: { data: IFile[] }) => void)
} = {
  rootTree: undefined,
  updateTreeView: undefined,
}

const FileTree: FC<FileTreeProps> = (props) => {
  const { data, onSelect } = props
  const { activeId, setFolderDataPure } = useEditorStore()
  const deferredActiveId = useDeferredValue(activeId)
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
          setFolderDataPure(tree.data)
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
          selection={deferredActiveId}
          indent={16}
          disableMultiSelection
          onSelect={(node) => onSelect(node[0]?.data)}
          onMove={onMove}
        >
          {(props) => {
            const isRoot = props.node.id === data[0]?.id
            if (isRoot) {
              fileTreeHandler.rootTree = props.tree
              fileTreeHandler.updateTreeView = (params) => {
                fileTreeHandler.rootTree?.update({
                  data: params.data,
                })
                useEditorStore.getState().setFolderDataPure(params.data)
              }
            }
            return FileNode({
              ...props,
              simpleTree: tree,
              setFolderData: setFolderDataPure,
              isRoot,
            })
          }}
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
