import classNames from 'classnames'
import type { FC, MouseEventHandler } from 'react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { FileNodeStyled } from './styles'
import type { IFile } from '@/helper/filesys'
import type { NewInputRef } from './NewFIleInput'
import NewFileInput from './NewFIleInput'
import bus from '@/helper/eventBus'
import useFileTreeContextMenuNode from '@/hooks/useContextMenuNode'

const FileNode: FC<FileNodeProps> = ({ item, level = 0, activeId, onSelect, open = false }) => {
  const [isOpen, setIsOpen] = useState(open)
  const newInputRef = useRef<NewInputRef>(null)
  const { contextMenuNode, setContextMenuNode } = useFileTreeContextMenuNode()
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

    bus.on('SIDEBAR:show-new-input', newFileHandler)

    return () => {
      bus.detach('SIDEBAR:show-new-input', newFileHandler)
    }
  }, [contextMenuNode, item])

  const handleClick: MouseEventHandler = useCallback(
    (e) => {
      e.stopPropagation()
      bus.emit('SIDEBAR:hide-new-input')
      setIsOpen(!isOpen)
    },
    [isOpen],
  )

  const handleSelect: MouseEventHandler = useCallback(() => {
    onSelect(item)
  }, [item, onSelect])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>, fileNode?: IFile) => {
      e.stopPropagation()
      const node = fileNode || item
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
