import type { FileEntry } from '@tauri-apps/api/fs'
import type { FC } from 'react'
import { memo } from 'react'
import type { BaseComponentProps } from '@types'
import classNames from 'classnames'
import FileNode from './FileNode'

const FileTree: FC<FileTreeProps> = (props) => {
  const { data, selectedPath, onSelect, className } = props

  const containerCls = classNames('w-full overflow-hidden truncate', className)

  return (
    <div className={containerCls}>
      {data?.map(item => (
        <FileNode key={item.name} item={item} level={0} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </div>
  )
}

interface FileTreeProps extends BaseComponentProps {
  data: FileEntry[] | null
  selectedPath?: string
  onSelect: (file: FileEntry) => void
}

export default memo(FileTree)
