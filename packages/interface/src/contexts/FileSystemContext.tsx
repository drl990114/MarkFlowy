import { createContext, useContext } from 'react'
import type { IFile } from '../types/file'

export interface MoveFileInfo {
  old_path: string
  new_path: string
  children: IFile[]
  is_folder: boolean
  is_replaced?: boolean
}

export interface FileSystemContextValue {
  /** Read a directory and return file tree */
  readDirectory: (folderPath: string) => Promise<IFile[]>
  /** Read a subdirectory and return file tree (for lazy loading) */
  readSubdirectory: (folderPath: string) => Promise<IFile[]>
  /** Write file content */
  writeFile: (filePath: string, content: string) => Promise<void>
  /** Delete a file */
  deleteFile: (filePath: string) => Promise<void>
  /** Delete a folder */
  deleteFolder: (filePath: string) => Promise<void>
  /** Delete a file or folder to trash */
  trashFile: (filePath: string) => Promise<void>
  /** Check if a path is a directory */
  isDir: (path: string) => Promise<boolean>
  /** Check if a file exists */
  fileExists: (filePath: string) => Promise<boolean>
  /** Move files to target folder */
  moveFilesToTargetFolder: (params: {
    files: string[]
    targetFolder: string
    replaceExist?: boolean
  }) => Promise<Array<{ old_path: string; new_path: string; children: IFile[]; is_folder: boolean; is_replaced?: boolean }>>
  /** Join paths */
  pathJoin: (path1: string, path2: string) => Promise<string>
  /** Get file name from path */
  getPathName: (path: string) => Promise<string>
  /** Get file content */
  getFileContent: (filePath: string) => Promise<string | null>
  /** Get markdown relative path */
  getMdRelativePath: (filePath: string, relativeTo: string) => Promise<string>
  /** Create a folder */
  createFolder: (path: string) => Promise<void>
  /** Rename/Move file */
  renameFile: (oldPath: string, newPath: string) => Promise<MoveFileInfo>
  /** Copy file */
  copyFile: (from: string) => Promise<string>
  /** Reveal item in folder (optional, may not be available in web) */
  revealInFolder?: (path: string) => Promise<void>
}

export const FileSystemContext = createContext<FileSystemContextValue | undefined>(undefined)

export const useFileSystem = () => {
  const ctx = useContext(FileSystemContext)
  if (!ctx) {
    throw new Error('useFileSystem must be used within a FileSystemProvider')
  }
  return ctx
}
