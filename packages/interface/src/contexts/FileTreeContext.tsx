import { createContext, useContext } from 'react'
import type { IFile } from '../types/file'

export interface FileTreeContextValue {
  /** Current active file id */
  activeId?: string
  /** Folder tree data */
  folderData: IFile[] | null
  /** Set folder data (resets opened files) */
  setFolderData: (folderData: IFile[]) => void
  /** Set folder data without resetting opened files */
  setFolderDataPure: (folderData: IFile[]) => void
  /** Delete a file node */
  deleteNode: (fileNode: IFile) => Promise<void>
  /** Move a file to trash */
  trashNode: (fileNode: IFile) => Promise<void>
  /** Get root path */
  getRootPath: () => string | undefined
  /** Refresh folder data */
  refreshFolder: () => Promise<void>
  /** Scroll tree to specific file id */
  scrollTo?: (id: string) => void
  /** Open/Close all folders */
  closeAll?: () => void
  /** Open a folder by id */
  openFolder?: (id: string) => void
}

export const FileTreeContext = createContext<FileTreeContextValue | undefined>(undefined)

export const useFileTree = () => {
  const ctx = useContext(FileTreeContext)
  if (!ctx) {
    throw new Error('useFileTree must be used within a FileTreeProvider')
  }
  return ctx
}
