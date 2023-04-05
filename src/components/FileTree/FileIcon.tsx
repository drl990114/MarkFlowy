import { FileIcon, FolderIcon } from '@icons'
import type { FC } from 'react'
import { memo } from 'react'

const FileNodeIcon: FC<FileIconProps> = ({ type }) => {
  return type === 'folder' ? <img src={FolderIcon} className={'w-20px m-2px label-hover'}/> : <img src={FileIcon} className={'w-20px m-2px label-hover'}/>
}

interface FileIconProps {
  type: 'folder' | 'file'
}

export default memo(FileNodeIcon)
