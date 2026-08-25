import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { useMemo, type FC, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import {
  AppContext,
  FileSystemContext,
  type AppContextValue,
  type FileSystemContextValue,
  type MoveFileInfo,
  type RunFileMutation,
} from '@markflowy/interface'
import { logger } from '@/helper/logger'
import { resolveFileExcludePatterns } from '@/helper/file-exclude'
import {
  FileResultCode,
  hydrateDirectoryEntries,
  unwrapDirectoryReadResult,
  type DirectoryReadEntry,
  type DirectoryReadResult,
  type IFile,
} from '@/helper/filesys'
import { useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { savePathCoordinator } from '@/components/EditorArea/savePathCoordinator'

interface FileSystemAdapterProps {
  children: ReactNode
}

const desktopAppContextValue = { copyText: writeText } satisfies AppContextValue

const runFileMutation: RunFileMutation = (operation) =>
  savePathCoordinator.runFileMutation((lease) =>
    operation({
      protectFileIds: (fileIds) => flushSync(() => lease.protectFileIds(fileIds)),
      protectPaths: (paths) => flushSync(() => lease.protectPaths(paths)),
    }),
  )

export const TauriFileSystemProvider: FC<FileSystemAdapterProps> = ({ children }) => {
  const fileExcludePatterns = useAppSettingStore((state) =>
    resolveFileExcludePatterns(state.settingData),
  )

  const value: FileSystemContextValue = useMemo(() => ({
    runFileMutation,

    readDirectory: async (folderPath: string): Promise<IFile[]> => {
      const result = await invoke<DirectoryReadResult>('open_folder_async', {
        folderPath,
        rootPath: folderPath,
        fileExcludePatterns,
      })
      return hydrateDirectoryEntries(unwrapDirectoryReadResult(result))
    },

    readSubdirectory: async (folderPath: string): Promise<IFile[]> => {
      const rootPath = useEditorStore.getState().getRootPath() || folderPath
      const result = await invoke<DirectoryReadResult>('open_folder_async', {
        folderPath,
        rootPath,
        fileExcludePatterns,
      })

      let entries: DirectoryReadEntry[]
      try {
        entries = unwrapDirectoryReadResult(result)
      } catch (error) {
        logger.error(`Failed to read subdirectory at ${folderPath}`, error)
        return []
      }

      if ((useEditorStore.getState().getRootPath() || folderPath) !== rootPath) {
        return []
      }
      return hydrateDirectoryEntries(entries)
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

    pathsReferToSameDirectoryEntry: async (path1: string, path2: string): Promise<boolean> => {
      return await invoke<boolean>('paths_refer_to_same_directory_entry', { path1, path2 })
    },

    moveFilesToTargetFolder: async (params: {
      files: string[]
      targetFolder: string
      replaceExist?: boolean
    }): Promise<MoveFileInfo[]> => {
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
  }), [fileExcludePatterns])

  return (
    <AppContext.Provider value={desktopAppContextValue}>
      <FileSystemContext.Provider value={value}>{children}</FileSystemContext.Provider>
    </AppContext.Provider>
  )
}
