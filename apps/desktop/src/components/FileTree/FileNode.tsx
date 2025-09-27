import {
  createFile,
  getFileNameFromPath,
  readDirectory,
  updateFile,
  type IFile,
} from '@/helper/filesys'
import { useEditorStore } from '@/stores'
import NiceModal from '@ebay/nice-modal-react'
import { invoke } from '@tauri-apps/api/core'
import { nanoid } from 'nanoid'
import { NodeRendererProps } from 'react-arborist'
import { useTranslation } from 'react-i18next'
import { Space, toast } from 'zens'
import { MODAL_CONFIRM_ID } from '../Modal'
import { MfIconButton } from '../UI/Button'
import { showContextMenu } from '../UI/ContextMenu'
import { MoveFileInfo, moveFileNode } from './file-operator'
import { fileTreeHandler } from './FileTree'
import NewFileInput from './NewFIleInput'
import { SimpleTree } from './SimpleTree'
import { NodeContainer } from './styles'

function FileNode({
  style,
  node,
  dragHandle,
  tree,
  simpleTree,
  setFolderData,
  isRoot = false,
}: NodeRendererProps<IFile> & {
  simpleTree: SimpleTree<IFile>
  setFolderData: any
  isRoot?: boolean
}) {
  const indentSize = Number.parseFloat(`${style.paddingLeft || 0}`)
  const { t } = useTranslation()
  const { deleteNode, setFolderDataPure, trashNode } = useEditorStore()

  const delFileHandler = () => {
    deleteNode(node.data).then(() => {
      simpleTree.drop({ id: node.id })
      setFolderData(simpleTree.data)
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
    if (inputType === 'dir') {
      await invoke('create_folder', {
        path: file.path,
      })
    } else {
      await invoke('write_file', {
        filePath: file.path,
        content: '',
      })
    }
    const targetFile = createFile({
      path: file.path,
      name: file.name,
      content: '',
      id: node.id,
      kind: file.kind,
    })

    simpleTree.update({
      id: node.id,
      changes: { ...node.data, ...targetFile },
    })
    setFolderData(simpleTree.data)
  }

  const renameFileHandler = async (file: IFile) => {
    const move_file_info = await invoke<MoveFileInfo>('rename_fs', {
      oldPath: node.data.path,
      newPath: file.path,
    })

    moveFileNode(simpleTree, move_file_info)

    updateFile({
      path: file.path,
      name: file.name,
      id: node.id,
      kind: file.kind,
    })

    simpleTree.update({
      id: node.id,
      changes: { kind: file.kind, name: file.name },
    })
    setFolderDataPure(simpleTree.data)
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
      selected={useEditorStore.getState().activeId === node.id}
      onContextMenu={(e) => {
        e.stopPropagation()
        e.preventDefault()
        const items = []

        if (node.parent) {
          items.push(
            {
              label: t('contextmenu.explorer.add_file'),
              value: 'new_file',
              handler: () => {
                if (node.parent) {
                  const data = { id: nanoid(), name: '', kind: 'pending_new_file' } as any
                  if (node.isInternal) {
                    node.open()
                  }
                  const parentId = node.isInternal ? node.id : node.parent.id

                  simpleTree.create({
                    parentId,
                    data,
                  })
                  tree.create({
                    parentId,
                    index: 0,
                  })

                  setFolderData(simpleTree.data)
                }
              },
            },
            {
              label: t('contextmenu.explorer.add_folder'),
              value: 'new_folder',
              handler: () => {
                if (node.parent) {
                  const data = {
                    id: nanoid(),
                    name: '',
                    kind: 'pending_new_folder',
                    children: [],
                  } as any
                  if (node.isInternal) {
                    node.open()
                  }
                  const parentId = node.isInternal ? node.id : node.parent.id

                  simpleTree.create({
                    parentId,
                    data,
                  })
                  tree.create({
                    parentId,
                    index: 0,
                    type: 'internal',
                  })

                  setFolderData(simpleTree.data)
                }
              },
            },
          )
        }

        if (node.data.kind === 'dir' || node.data.ext === 'md') {
          items.push({
            label: t('contextmenu.explorer.rename'),
            value: 'rename',
            handler: () => {
              if (node.parent) {
                simpleTree.update({
                  id: node.id,
                  changes: {
                    kind: node.data.kind === 'dir' ? 'pending_edit_folder' : 'pending_edit_file',
                  },
                })
                setFolderDataPure(simpleTree.data)
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

        if (node.data.kind === 'file') {
          items.push({
            value: 'copy',
            label: t('contextmenu.explorer.copy'),
            handler: () => {
              invoke<string>('copy_file_by_from', {
                from: node.data.path,
              }).then((targetPath) => {
                if (node.parent) {
                  const file = createFile({
                    name: getFileNameFromPath(targetPath),
                    path: targetPath,
                  })

                  const parentId = node.parent.id

                  simpleTree.create({
                    parentId,
                    data: file,
                    index: node.rowIndex,
                  })
                  tree.create({
                    parentId,
                    index: node.rowIndex,
                  })
                  setFolderData(simpleTree.data)
                }
              })
            },
          })
        }

        items.push({
          value: 'trash',
          label: t('contextmenu.explorer.moveto_trash'),
          handler: () => {
            NiceModal.show(MODAL_CONFIRM_ID, {
              title: t('confirm.trash.description', {
                name: node.data.name,
                something: node.data.kind === 'dir' ? t('common.folder') : t('common.file'),
              }),
              onConfirm: () => {
                trashNode(node.data).then(() => {
                  simpleTree.drop({ id: node.id })
                  setFolderData(simpleTree.data)
                })
              },
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
                if (isUpdate) {
                  simpleTree.update({
                    id: node.id,
                    changes: { kind: node.data.kind === 'pending_edit_folder' ? 'dir' : 'file' },
                  })
                } else {
                  simpleTree.drop({ id: node.id })
                }

                setFolderData(simpleTree.data)
              }

              if (!fileInfo) {
                cancelInput()
                return
              }

              NiceModal.show(MODAL_CONFIRM_ID, {
                title: t('confirm.edit_filename_cancel.description'),
                confirmText: t('action.save'),
                cancelText: t('action.unsave'),
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
            <div style={{ flex: 1 }}>
              {node.data?.kind === 'dir' ? (
                <i
                  className={`${node.isOpen ? 'ri-folder-5-line' : 'ri-folder-3-line'} file-icon`}
                />
              ) : (
                <i className={`${getFileIconClass(node.data)} file-icon`} />
              )}
              <span
                style={{
                  whiteSpace: 'nowrap',
                }}
              >
                {node.data.name}
              </span>
            </div>

            {isRoot ? (
              <Space size={2}>
                <MfIconButton
                  size='small'
                  rounded='smooth'
                  icon={'ri-refresh-line'}
                  onClick={async (e) => {
                    e?.stopPropagation()
                    e?.preventDefault()
                    const rootPath = useEditorStore.getState().getRootPath()
                    if (!rootPath) {
                      toast.error('No workspace found')
                      return
                    }
                    await readDirectory(rootPath).then((res) => {
                      fileTreeHandler.updateTreeView?.({
                        data: res,
                      })
                    })
                  }}
                  tooltipProps={{ title: t('explorer.refresh_folder_data') }}
                />
                <MfIconButton
                  size='small'
                  rounded='smooth'
                  icon={'ri-focus-3-line'}
                  onClick={(e) => {
                    e?.stopPropagation()
                    e?.preventDefault()

                    const activeId = useEditorStore.getState().activeId
                    if (activeId) {
                      tree.scrollTo(activeId)
                    }
                  }}
                  tooltipProps={{ title: t('explorer.focus_active_file') }}
                />
                <MfIconButton
                  size='small'
                  rounded='smooth'
                  icon={'ri-collapse-vertical-fill'}
                  onClick={(e) => {
                    e?.stopPropagation()
                    e?.preventDefault()

                    tree.closeAll()
                    node.open()
                  }}
                  tooltipProps={{ title: t('explorer.collapse_folders') }}
                />
              </Space>
            ) : null}
          </div>
        )}
      </div>
    </NodeContainer>
  )
}

export default FileNode

const extFileIconClassMap: Record<string, string> = {
  md: 'ri-markdown-fill',
  markdown: 'ri-markdown-fill',
}

const getFileIconClass = (file: IFile) => {
  const ext = file.ext
  if (ext && extFileIconClassMap[ext]) {
    return extFileIconClassMap[ext]
  }

  return 'ri-file-text-fill'
}
