import { FileIcon, FolderIcon } from '@icons'
import { FC, memo } from 'react'

const FileNodeIcon: FC<FileIconProps> = ({ type }) => {
  return type === 'folder' ?  <img src={FolderIcon} className={"w-20px label-hover"}/>  : <img src={FileIcon} className={"w-20px label-hover"}/>
}

interface FileIconProps {
  type: 'folder' | 'file'
}

export default memo(FileNodeIcon)
