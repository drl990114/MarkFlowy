import classNames from 'classnames'
import type { FC } from 'react'
import { memo, useCallback } from 'react'
import FileNode from './FileNode'
import type { IFile } from '@/helper/filesys'
import { FileNodeContextMenu } from './FileNodeContextMenu'
import useFileTreeContextMenu from '@/hooks/useContextMenu'

const FileTree: FC<FileTreeProps> = (props) => {
  const { data, activeId, onSelect, className } = props
  const { setOpen, points, setPoints } = useFileTreeContextMenu()

  const containerCls = classNames('w-full overflow-hidden', className)

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      e.preventDefault()
      setOpen(true)
      setPoints({
        x: e.clientX,
        y: e.clientY,
      })
    },
    [setOpen, setPoints],
  )

  return (
    <div className={containerCls} onContextMenuCapture={handleContextMenu}>
      {data?.map((item) => (
        <FileNode key={item.name} item={item} level={0} activeId={activeId} onSelect={onSelect} />
      ))}
      <FileNodeContextMenu top={points.y} left={points.x} />
    </div>
  )
}

interface FileTreeProps extends Global.BaseComponentProps {
  data: IFile[] | null
  activeId?: string
  onSelect: (file: IFile) => void
}

export default memo(FileTree)
