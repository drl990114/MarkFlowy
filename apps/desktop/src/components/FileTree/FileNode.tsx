import classNames from 'classnames'
import type { FC, MouseEventHandler } from 'react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { FileNodeStyled } from './styles'
import type { IFile } from '@/helper/filesys'
import type { NewInputRef } from './NewFIleInput'
import NewFileInput from './NewFIleInput'
import bus from '@/helper/eventBus'
import useFileTreeContextMenuNode from '@/hooks/useContextMenuNode'
import { useEditorStore } from '@/stores'
import { EVENT } from '@/constants'

const FileNode: FC<FileNodeProps> = ({ item, level = 0, activeId, onSelect, open = false }) => {
  const [isOpen, setIsOpen] = useState(open)
  const newInputRef = useRef<NewInputRef>(null)
  const { contextMenuNode, setContextMenuNode } = useFileTreeContextMenuNode()
  const { deleteFile } = useEditorStore()
  const isActived = activeId === item.id
  const isFolder = item.kind === 'dir'

  useEffect(() => {
    setIsOpen(open)
  }, [open])

  useEffect(() => {
    const newFileHandler = () => {
      if (!contextMenuNode || contextMenuNode.id !== item.id) return
      newInputRef.current?.show({ fileNode: contextMenuNode })
    }

    const delFileHandler = () => {
      if (!contextMenuNode || contextMenuNode.id !== item.id) return
      deleteFile(contextMenuNode)
    }

    bus.on(EVENT.sidebar_show_new_input, newFileHandler)
    bus.on(EVENT.sidebar_delete_file, delFileHandler)

    return () => {
      bus.detach(EVENT.sidebar_show_new_input, newFileHandler)
      bus.detach(EVENT.sidebar_delete_file, delFileHandler)
    }
  }, [contextMenuNode, item, deleteFile])

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
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>, fileNode?: IFile) => {
      const node = fileNode || item
      e.stopPropagation()
      setContextMenuNode(node)
    },
    [item, setContextMenuNode],
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
