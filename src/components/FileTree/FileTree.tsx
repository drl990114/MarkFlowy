import type { FileEntry } from '@tauri-apps/api/fs'
import type { FC } from 'react'
import { memo } from 'react'
import type { BaseComponentProps } from '@types'
import classNames from 'classnames'
import FileNode from './FileNode'
import { IFile } from '../../utils/filesys'

const FileTree: FC<FileTreeProps> = (props) => {
  const { data, activeId, onSelect, className } = props

  const containerCls = classNames('w-full overflow-hidden truncate', className)

  return (
    <div className={containerCls}>
      {data?.map(item => (
        <FileNode key={item.name} item={item} level={0} activeId={activeId} onSelect={onSelect} />
      ))}
    </div>
  )
}

interface FileTreeProps extends BaseComponentProps {
  data: IFile[] | null
  activeId?: string
  onSelect: (file: IFile) => void
}

export default memo(FileTree)
