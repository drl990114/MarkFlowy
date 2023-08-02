import classNames from 'classnames'
import type { FC, MouseEventHandler } from 'react'
import { memo, useCallback, useState } from 'react'
import { FileNodeStyled } from './styles'
import type { IFile } from '@/helper/filesys'

const FileNode: FC<FileNodeProps> = ({
  item,
  level = 0,
  activeId,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const isActived = activeId === item.id
  const isFolder = item.kind === 'dir'

  const handleClick: MouseEventHandler = useCallback(
    (e) => {
      e.stopPropagation()
      setIsOpen(!isOpen)
    },
    [isOpen],
  )

  const handleSelect: MouseEventHandler = useCallback(
    () => {
      onSelect(item)
    },
    [item, onSelect],
  )

  const nodeWrapperCls = classNames('file-node', {
    'file-node--active': isActived,
  })

  const iconCls = 'file-icon'

  return (
    <FileNodeStyled onClick={handleClick}>
      <div
        className={nodeWrapperCls}
        style={{ paddingLeft: level * 16 + 6 }}
        onClick={handleSelect}
      >
        {isFolder
          ? (
          <i className={`${isOpen ? 'ri-folder-5-line' : 'ri-folder-3-line'} ${iconCls}`} />
            )
          : (
          <i className={`ri-markdown-fill ${iconCls}`} />
            )}
        <div className="file-node__text">{item.name}</div>
      </div>
      {isOpen
        && item.children
        && item.children.map(child => (
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
  activeId?: string
  onSelect: (file: IFile) => void
}

export default memo(FileNode)
