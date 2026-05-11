import type { FC, ReactNode } from 'react'
import {
  FileSystemContext,
  FileSystemContextValue,
  MoveFileInfo,
} from '@markflowy/interface'
import type { IFile } from '@markflowy/interface'

interface FileSystemAdapterProps {
  children: ReactNode
  readSubdirectory?: (folderPath: string) => Promise<IFile[]>
}

/**
 * WebFileSystem Provider - Mock implementation for web environment
 * Since web version doesn't have real file system access, most operations are no-ops
 */
export const WebFileSystemProvider: FC<FileSystemAdapterProps> = ({ children, readSubdirectory }) => {
  const value: FileSystemContextValue = {
    readDirectory: async (): Promise<IFile[]> => {
      return []
    },

    readSubdirectory: async (folderPath: string): Promise<IFile[]> => {
      if (readSubdirectory) {
        return readSubdirectory(folderPath)
      }
      return []
    },

    writeFile: async (): Promise<void> => {
      // No-op in web
    },

    deleteFile: async (): Promise<void> => {
      // No-op in web
    },

    deleteFolder: async (): Promise<void> => {
      // No-op in web
    },

    trashFile: async (): Promise<void> => {
      // No-op in web
    },

    isDir: async (): Promise<boolean> => {
      return false
    },

    fileExists: async (): Promise<boolean> => {
      return false
    },

    moveFilesToTargetFolder: async (): Promise<Array<MoveFileInfo>> => {
      return []
    },

    pathJoin: async (path1: string, path2: string): Promise<string> => {
      // Simple path join for web
      if (path1.endsWith('/')) {
        return `${path1}${path2}`
      }
      return `${path1}/${path2}`
    },

    getPathName: async (path: string): Promise<string> => {
      const parts = path.split('/')
      return parts[parts.length - 1] || path
    },

    getFileContent: async (): Promise<string | null> => {
      return null
    },

    getMdRelativePath: async (filePath: string): Promise<string> => {
      return filePath
    },

    createFolder: async (): Promise<void> => {
      // No-op in web
    },

    renameFile: async (oldPath: string, newPath: string): Promise<MoveFileInfo> => {
      return {
        old_path: oldPath,
        new_path: newPath,
        children: [],
        is_folder: false,
      }
    },

    copyFile: async (from: string): Promise<string> => {
      return from
    },

    // revealInFolder is not available in web
  }

  return <FileSystemContext.Provider value={value}>{children}</FileSystemContext.Provider>
}
