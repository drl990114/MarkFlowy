import type { FileEntry } from '@tauri-apps/api/fs'
import classNames from 'classnames'
import type { FC, MouseEventHandler } from 'react'
import { memo, useCallback, useState } from 'react'
import FileNodeIcon from './FileIcon'

const FileNode: FC<FileNodeProps> = ({ item, level = 0, selectedPath, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false)
  const isSelected = selectedPath === item.name
  const isFolder = !!item.children

  const handleClick: MouseEventHandler = useCallback(
    (e) => {
      e.stopPropagation()
      setIsOpen(!isOpen)
    },
    [isOpen],
  )

  const handleSelect: MouseEventHandler = useCallback(
    (e) => {
      onSelect(item)
    },
    [item, onSelect],
  )

  const nodeWrapperCls = classNames('flex label-hover cursor-pointer', {
    'bg-primary': isSelected,
  })

  return (
    <div onClick={handleClick}>
      <div className={nodeWrapperCls} style={{ paddingLeft: level * 16 + 6 }} onClick={handleSelect}>
        <FileNodeIcon type={isFolder ? 'folder' : 'file'} />
        <div className="name">
          {item.name}
        </div>
      </div>
      {isOpen && item.children && item.children.map(child => <FileNode key={child.name} item={child} level={level + 1} selectedPath={selectedPath} onSelect={onSelect} />)}
    </div>
  )
}

interface FileNodeProps {
  item: FileEntry
  level: number
  selectedPath?: string
  onSelect: (file: FileEntry) => void
}

export default memo(FileNode)
