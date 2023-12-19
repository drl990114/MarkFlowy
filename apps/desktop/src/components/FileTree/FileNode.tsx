import classNames from 'classnames'
import type { FC, MouseEventHandler } from 'react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { FileNodeStyled } from './styles'
import type { IFile } from '@/helper/filesys'
import type { NewInputRef } from './NewFIleInput'
import NewFileInput from './NewFIleInput'
import bus from '@/helper/eventBus'
import { useEditorStore } from '@/stores'
import { EVENT } from '@/constants'
import { showContextMenu } from '../UI/ContextMenu'
import { useModal } from '@ebay/nice-modal-react'
import { Modal } from '..'

const FileNode: FC<FileNodeProps> = ({ item, level = 0, activeId, onSelect, open = false }) => {
  const [isOpen, setIsOpen] = useState(open)
  const newInputRef = useRef<NewInputRef>(null)
  const { deleteNode } = useEditorStore()
  const modal = useModal(Modal.Confirm)
  const isActived = activeId === item.id
  const isFolder = item.kind === 'dir'

  useEffect(() => {
    setIsOpen(open)
  }, [open])

  const handleClick: MouseEventHandler = useCallback(
    (e) => {
      e.stopPropagation()
      bus.emit(EVENT.sidebar_hide_new_input)
      setIsOpen(!isOpen)
    },
    [isOpen],
  )

  const handleSelect: MouseEventHandler = useCallback(() => {
    onSelect(item)
  }, [item, onSelect])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      e.preventDefault()
      e.stopPropagation()
      const contextMenuNode = item

      const newFileHandler = () => {
        newInputRef.current?.show({ fileNode: contextMenuNode })
      }

      const delFileHandler = () => {
        deleteNode(contextMenuNode)
      }

      const contextMenuItems = [
        {
          value: 'add_file',
          label: 'Add File',
          handler: () => {
            newFileHandler()
          },
        },
      ]

      if (level !== 0) {
        contextMenuItems.push({
          value: item.kind === 'dir' ? 'delete_folder' : 'delete_file',
          label: item.kind === 'dir' ? 'Delete Folder' : 'Delete File',
          handler: () => {
            modal.show({
              title: `Are you sure you want to permanently delete ${item.name}`,
              onConfirm: delFileHandler,
            })
          },
        })
      }

      showContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: contextMenuItems,
      })
    },
    [deleteNode, modal, item, level],
  )

  const nodeWrapperCls = classNames('file-node', {
    'file-node--active': isActived,
  })

  const iconCls = 'file-icon'

  return (
    <FileNodeStyled onClick={handleClick} onContextMenu={handleContextMenu}>
      <NewFileInput ref={newInputRef} autoFocus style={{ marginLeft: level * 16 + 6 }} />
      <div
        className={nodeWrapperCls}
        style={{ paddingLeft: level * 16 + 6 }}
        onClick={handleSelect}
      >
        {isFolder ? (
          <i className={`${isOpen ? 'ri-folder-5-line' : 'ri-folder-3-line'} ${iconCls}`} />
        ) : (
          <i className={`ri-markdown-fill ${iconCls}`} />
        )}
        <div className='file-node__text'>{item.name}</div>
      </div>
      {isOpen &&
        item.children &&
        item.children.map((child) => (
          <FileNode
            key={child.name}
            item={child}
            level={level + 1}
            activeId={activeId}
            onSelect={onSelect}
          />
        ))}
    </FileNodeStyled>
  )
}

interface FileNodeProps {
  item: IFile
  level: number
  open?: boolean
  activeId?: string
  onSelect: (file: IFile) => void
}

export default memo(FileNode)
