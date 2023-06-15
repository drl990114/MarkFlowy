import { IFile } from '@/helper/filesys'
import classNames from 'classnames'
import type { FC } from 'react'
import { memo } from 'react'
import FileNode from './FileNode'

const FileTree: FC<FileTreeProps> = (props) => {
  const { data, activeId, onSelect, className } = props

  const containerCls = classNames('w-full overflow-hidden', className)

  return (
    <div className={containerCls}>
      {data?.map(item => (
        <FileNode key={item.name} item={item} level={0} activeId={activeId} onSelect={onSelect} />
      ))}
    </div>
  )
}

interface FileTreeProps extends Global.BaseComponentProps {
  data: IFile[] | null
  activeId?: string
  onSelect: (file: IFile) => void
}

export default memo(FileTree)
