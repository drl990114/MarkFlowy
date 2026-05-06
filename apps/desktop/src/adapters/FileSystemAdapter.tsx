import { invoke } from '@tauri-apps/api/core'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { nanoid } from 'nanoid'
import type { FC, ReactNode } from 'react'
import {
  FileSystemContext,
  FileSystemContextValue,
  MoveFileInfo,
} from '@markflowy/interface'
import { FileResultCode, FileSysResult, IFile } from '@/helper/filesys'
import { getFileObjectByPath, setFileObject, setFileObjectByPath } from '@/helper/files'

interface FileSystemAdapterProps {
  children: ReactNode
}

export const TauriFileSystemProvider: FC<FileSystemAdapterProps> = ({ children }) => {
  const value: FileSystemContextValue = {
    readDirectory: async (folderPath: string): Promise<IFile[]> => {
      const result = await invoke<FileSysResult>('open_folder_async', { folderPath })
      if (result.code !== FileResultCode.Success) {
        throw new Error(`Failed to read directory: ${result.code}`)
      }
      const files = JSON.parse(result.content)
      // Note: wrapFiles logic should be handled by the caller
      return files
    },

    readSubdirectory: async (folderPath: string): Promise<IFile[]> => {
      const result = await invoke<FileSysResult>('open_folder_async', { folderPath })
      if (result.code !== FileResultCode.Success) {
        return []
      }
      const files = JSON.parse(result.content) as IFile[]

      const wrapFiles = (entries: IFile[]) => {
        entries.forEach((entry) => {
          entry.id = getFileObjectByPath(entry.path)?.id || nanoid()
          setFileObject(entry.id, entry)
          setFileObjectByPath(entry.path!, entry)
          if (entry.children) {
            wrapFiles(entry.children)
          }
        })
      }
      wrapFiles(files)

      return files
    },

    writeFile: async (filePath: string, content: string): Promise<void> => {
      await invoke('write_file', { filePath, content })
    },

    deleteFile: async (filePath: string): Promise<void> => {
      await invoke('delete_file', { filePath })
    },

    deleteFolder: async (filePath: string): Promise<void> => {
      await invoke('delete_folder', { filePath })
    },

    trashFile: async (filePath: string): Promise<void> => {
      await invoke('trash_delete', { path: filePath })
    },

    isDir: async (path: string): Promise<boolean> => {
      return await invoke<boolean>('is_dir', { path })
    },

    fileExists: async (filePath: string): Promise<boolean> => {
      return await invoke<boolean>('file_exists', { filePath })
    },

    moveFilesToTargetFolder: async (params: {
      files: string[]
      targetFolder: string
      replaceExist?: boolean
    }): Promise<Array<MoveFileInfo>> => {
      return await invoke('move_files_to_target_folder', {
        files: params.files,
        targetFolder: params.targetFolder,
        replaceExist: params.replaceExist,
      })
    },

    pathJoin: async (path1: string, path2: string): Promise<string> => {
      return await invoke<string>('path_join', { path1, path2 })
    },

    getPathName: async (path: string): Promise<string> => {
      return await invoke<string>('get_path_name', { path })
    },

    getFileContent: async (filePath: string): Promise<string | null> => {
      try {
        const content = await invoke<string>('read_file', { filePath })
        return content
      } catch {
        return null
      }
    },

    getMdRelativePath: async (filePath: string, relativeTo: string): Promise<string> => {
      const res = await invoke<{ code: FileResultCode; content: string }>('get_md_relative_path', {
        filePath,
        relativeTo,
      })
      if (res.code !== FileResultCode.Success) {
        return filePath
      }
      return res.content
    },

    createFolder: async (path: string): Promise<void> => {
      await invoke('create_folder', { path })
    },

    renameFile: async (oldPath: string, newPath: string): Promise<MoveFileInfo> => {
      return await invoke<MoveFileInfo>('rename_fs', { oldPath, newPath })
    },

    copyFile: async (from: string): Promise<string> => {
      return await invoke<string>('copy_file_by_from', { from })
    },

    revealInFolder: async (path: string): Promise<void> => {
      await revealItemInDir(path)
    },
  }

  return <FileSystemContext.Provider value={value}>{children}</FileSystemContext.Provider>
}
