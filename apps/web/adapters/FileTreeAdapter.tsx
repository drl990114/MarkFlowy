import type { FC, ReactNode } from 'react'
import {
  FileTreeContext,
  FileTreeContextValue,
  fileTreeHandler,
} from '@markflowy/interface'
import type { IFile } from '@markflowy/interface'

interface FileTreeAdapterProps {
  children: ReactNode
  /** Mock folder data for display */
  folderData?: IFile[] | null
  /** Current active file id */
  activeId?: string
  /** Callback when folder data changes */
  onFolderDataChange?: (data: IFile[]) => void
  /** Callback when active id changes */
  onActiveIdChange?: (id: string) => void
}

/**
 * Web FileTree Provider - Adapter for web environment
 * Provides a simplified file tree context for web usage
 */
export const FileTreeProvider: FC<FileTreeAdapterProps> = ({
  children,
  folderData = null,
  activeId,
  onFolderDataChange,
  onActiveIdChange,
}) => {
  const value: FileTreeContextValue = {
    activeId,
    folderData,
    setFolderData: (data: IFile[]) => {
      onFolderDataChange?.(data)
    },
    setFolderDataPure: (data: IFile[]) => {
      onFolderDataChange?.(data)
    },
    deleteNode: async () => {
      // No-op in web
    },
    trashNode: async () => {
      // No-op in web
    },
    getRootPath: () => undefined,
    refreshFolder: async () => {
      // No-op in web
    },
    scrollTo: () => {
      // No-op in web
    },
    closeAll: () => {
      // No-op in web
    },
    openFolder: () => {
      // No-op in web
    },
  }

  return <FileTreeContext.Provider value={value}>{children}</FileTreeContext.Provider>
}
