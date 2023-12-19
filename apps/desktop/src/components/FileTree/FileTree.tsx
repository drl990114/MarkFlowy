import classNames from 'classnames'
import type { FC } from 'react'
import { memo } from 'react'
import FileNode from './FileNode'
import type { IFile } from '@/helper/filesys'

const FileTree: FC<FileTreeProps> = (props) => {
  const { data, activeId, onSelect, className } = props
  const containerCls = classNames('w-full overflow-hidden', className)

  if (data === null) return null

  return (
    <div className={containerCls}>
      <FileNode open={true} item={data?.[0]} level={0} activeId={activeId} onSelect={onSelect} />
    </div>
  )
}

interface FileTreeProps extends BaseComponentProps {
  data: IFile[] | null
  activeId?: string
  onSelect: (file: IFile) => void
}

export default memo(FileTree)
