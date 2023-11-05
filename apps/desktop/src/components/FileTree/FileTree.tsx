import classNames from 'classnames'
import type { FC } from 'react'
import { memo, useCallback, useState } from 'react'
import FileNode from './FileNode'
import type { IFile } from '@/helper/filesys'
import { FileNodeContextMenu } from './FileNodeContextMenu'
import useFileTreeContextMenu from '@/hooks/useContextMenu'
import { RootFolderTab } from './styles'

const FileTree: FC<FileTreeProps> = (props) => {
  const { data, activeId, onSelect, className } = props
  const { setOpen, points, setPoints } = useFileTreeContextMenu()
  const rootFolderNode = data?.[0]?.kind === 'dir' ? data[0] : null
  const [folderVisible, setFolderVisible] = useState(true)

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

  const containerCls = classNames('w-full overflow-hidden', className)

  const rootFolderTabIconCls = classNames('arrow-icon', {
    'arrow-icon__down': folderVisible,
  })

  return (
    <div className={containerCls}>
      {rootFolderNode ? (
        <RootFolderTab onClick={() => setFolderVisible((prev) => !prev)}>
          <div className={rootFolderTabIconCls}>
            <i className='ri-arrow-drop-right-line'></i>
          </div>
          {rootFolderNode.name}
        </RootFolderTab>
      ) : null}

      <div onContextMenuCapture={handleContextMenu}>
        {folderVisible
          ? (rootFolderNode?.children || data)?.map((item) => (
              <FileNode
                key={item.name}
                item={item}
                level={0}
                activeId={activeId}
                onSelect={onSelect}
              />
            ))
          : null}
      </div>

      <FileNodeContextMenu top={points.y} left={points.x} />
    </div>
  )
}

interface FileTreeProps extends BaseComponentProps {
  data: IFile[] | null
  activeId?: string
  onSelect: (file: IFile) => void
}

export default memo(FileTree)
