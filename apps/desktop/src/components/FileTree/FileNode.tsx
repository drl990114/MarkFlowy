import { createFile, type IFile } from '@/helper/filesys'
import { NodeRendererProps } from 'react-arborist'
import { NodeContainer } from './styles'
import { invoke } from '@tauri-apps/api/core'
import { showContextMenu } from '../UI/ContextMenu'
import { nanoid } from 'nanoid'
import { SimpleTree } from './SimpleTree'
import NewFileInput from './NewFIleInput'
import { useTranslation } from 'react-i18next'
import NiceModal from '@ebay/nice-modal-react'
import { MODAL_CONFIRM_ID } from '../Modal'
import { useEditorStore } from '@/stores'

function FileNode({
  style,
  node,
  dragHandle,
  tree,
  simpleTree,
  setFolderData,
}: NodeRendererProps<IFile> & {
  simpleTree: SimpleTree<IFile>
  setFolderData: any
}) {
  const indentSize = Number.parseFloat(`${style.paddingLeft || 0}`)
  const { t } = useTranslation()
  const { deleteNode } = useEditorStore()

  const delFileHandler = () => {
    deleteNode(node.data).then(() => {
      simpleTree.drop({ id: node.id })
      setFolderData(simpleTree.data)
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
      selected={tree.selectedNodes.includes(node)}
      onContextMenu={(e) => {
        e.stopPropagation()
        e.preventDefault()
        const items = []

        if (node.parent) {
          items.push({
            label: t('contextmenu.explorer.add_file'),
            value: 'new_file',
            handler: () => {
              if (node.parent) {
                const data = { id: nanoid(), name: '', kind: 'pending' } as any
                if (node.isInternal) {
                  node.open()
                }
                simpleTree.create({
                  parentId: node.parent.id,
                  data,
                  index: 0,
                  nodeId: node.id,
                  nodeType: node.isLeaf ? 'leaf' : 'internal',
                })
                tree.create({
                  parentId: node.parent?.id,
                  index: 0,
                })

                setFolderData(simpleTree.data)
              }
            },
          })
        }
        items.push({
          value: node.data.kind === 'dir' ? 'delete_folder' : 'delete_file',
          label:
            node.data.kind === 'dir'
              ? t('contextmenu.explorer.delete_folder')
              : t('contextmenu.explorer.delete_file'),
          handler: () => {
            NiceModal.show(MODAL_CONFIRM_ID, {
              title: t('confirm.delete.description', {
                name: node.data.name,
                something: node.data.kind === 'dir' ? t('common.folder') : t('common.file'),
              }),
              onConfirm: delFileHandler,
            })
          },
        })

        showContextMenu({
          x: e.clientX,
          y: e.clientY,
          items,
        })
      }}
      onClick={(e) => {
        if (e.shiftKey) {
          return
        }
        node.isInternal && node.toggle()
      }}
      ref={dragHandle}
    >
      <div style={{ display: 'flex', paddingLeft: '6px' }}>
        <div className='indentLines'>
          {new Array(indentSize / 16).fill(0).map((_, index) => {
            return <div key={index}></div>
          })}
        </div>

        {node.data.kind === 'pending' ? (
          <NewFileInput
            style={{ paddingTop: 0, paddingBottom: 0 }}
            fileNode={node.data}
            parentNode={node.parent?.data}
            onCreate={async (file) => {
              const targetFile = createFile({
                path: file.path,
                name: file.name,
                content: '',
                id: node.id,
              })

              console.log('onCreate', targetFile)
              await invoke('write_file', {
                filePath: targetFile.path,
                content: targetFile.content,
              })

              simpleTree.update({
                id: node.id,
                changes: { ...node.data, ...targetFile },
              })
              setFolderData(simpleTree.data)
            }}
            onCancel={() => {
              simpleTree.drop({ id: node.id })
              setFolderData(simpleTree.data)
            }}
          />
        ) : (
          <>
            {node.data?.kind === 'dir' ? (
              <i className={`${node.isOpen ? 'ri-folder-5-line' : 'ri-folder-3-line'} file-icon`} />
            ) : (
              <i className={`ri-markdown-fill file-icon`} />
            )}
            {node.data.name}
          </>
        )}
      </div>
    </NodeContainer>
  )
}

export default FileNode
