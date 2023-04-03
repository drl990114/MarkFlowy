import type { FileEntry } from '@tauri-apps/api/fs'
import type { FC } from 'react'
import { memo } from 'react'
import FileNode from './FileNode'

const FileTree: FC<FileTreeProps> = ({ data, selectedPath, onSelect }) => {
  return (
    <div className="file-tree">
      {data?.map(item => (
        <FileNode key={item.name} item={item} level={0} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </div>
  )
}

interface FileTreeProps {
  data: FileEntry[] | null
  selectedPath?: string
  onSelect: (file: FileEntry) => void
}

export default memo(FileTree)
