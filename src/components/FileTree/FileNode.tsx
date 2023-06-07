import type { IFile } from '@/utils/filesys'
import classNames from 'classnames'
import type { FC, MouseEventHandler } from 'react'
import { memo, useCallback, useState } from 'react'
import './index.css'

const FileNode: FC<FileNodeProps> = ({ item, level = 0, activeId, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false)
  const isActived = activeId === item.id
  const isFolder = item.kind === 'dir'

  const handleClick: MouseEventHandler = useCallback(
    (e) => {
      e.stopPropagation()
      setIsOpen(!isOpen)
    },
    [isOpen]
  )

  const handleSelect: MouseEventHandler = useCallback(
    (e) => {
      onSelect(item)
    },
    [item, onSelect]
  )

  const nodeWrapperCls = classNames('file-node w-full flex items-center label-default cursor-pointer', {
    'bg-bgColor': isActived,
  })

  const iconCls = 'file-icon w-20px m-2px flex-shrink-0'
  return (
    <div onClick={handleClick}>
      <div className={nodeWrapperCls} style={{ paddingLeft: level * 16 + 6 }} onClick={handleSelect}>
        {isFolder ? <i className={`ri-file-3-line ${iconCls}`} /> : <i className={`ri-folder-3-line ${iconCls}`} />}
        <div className="truncate">{item.name}</div>
      </div>
      {isOpen && item.children && item.children.map((child) => <FileNode key={child.name} item={child} level={level + 1} activeId={activeId} onSelect={onSelect} />)}
    </div>
  )
}

interface FileNodeProps {
  item: IFile
  level: number
  activeId?: string
  onSelect: (file: IFile) => void
}

export default memo(FileNode)
