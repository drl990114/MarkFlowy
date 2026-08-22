import { useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import type { IFile } from '@markflowy/interface'
import { FileResultCode } from '@markflowy/interface'
import { invoke } from '@tauri-apps/api/core'
import { nanoid } from 'nanoid'
import { resolveFileExcludePatterns } from './file-exclude'
import {
  deletePathEntry,
  getFileObject,
  getFileObjectByPath,
  setFileObject,
  setFileObjectByPath,
  setFileObjects,
  setFileObjectsByPath,
} from './files'

export { FileResultCode } from '@markflowy/interface'
export type { FileEntry, FileSysResult, IFile } from '@markflowy/interface'

export interface DirectoryReadEntry {
  name: string
  kind: 'file' | 'dir'
  path: string
  children: DirectoryReadEntry[] | null
  ext: string
}

export interface DirectoryReadResult {
  code: FileResultCode
  entries: DirectoryReadEntry[]
  message?: string
}

// 安全范围管理已移至 Rust 后端（fc.rs），macOS 上 plugin-fs 的 start/stopAccessingSecurityScopedResource 为 no-op
export async function releaseSecurityScope(path?: string) {
  if (!path) return
  await invoke('release_security_scopes', { path })
}

export const hydrateDirectoryEntries = (entries: DirectoryReadEntry[]): IFile[] => {
  const idEntries: { id: string; file: IFile }[] = []
  const pathEntries: { path: string; file: IFile }[] = []

  const visit = (items: DirectoryReadEntry[]): IFile[] => {
    return items.map((entry) => {
      const file: IFile = {
        id: getFileObjectByPath(entry.path)?.id || nanoid(),
        name: entry.name,
        kind: entry.kind,
        path: entry.path,
        ext: entry.ext,
      }

      idEntries.push({ id: file.id, file })
      pathEntries.push({ path: entry.path, file })

      if (entry.children) {
        file.children = visit(entry.children)
      }

      return file
    })
  }

  const files = visit(entries)
  setFileObjects(idEntries)
  setFileObjectsByPath(pathEntries)
  return files
}

export const unwrapDirectoryReadResult = (
  result: DirectoryReadResult,
): DirectoryReadEntry[] => {
  if (result.code !== FileResultCode.Success) {
    const detail = result.message ? ` (${result.message})` : ''
    throw new Error(`Failed to read directory: ${result.code}${detail}`)
  }

  return result.entries
}

export const createFile = (opt?: Partial<IFile>): IFile => {
  const file: IFile = {
    id: nanoid(),
    name: 'Untitled.md',
    kind: 'file',
    path: undefined,
    ext: 'md',
    content: '',
    ...opt,
  }

  setFileObject(file.id, file)

  if (file.path) {
    setFileObjectByPath(file.path, file)
  }
  return file
}

export const updateFile = (changes: Partial<IFile> & Pick<IFile, 'id'>): IFile => {
  const currentFile = getFileObject(changes.id)
  const nextFile = { ...currentFile, ...changes } as IFile

  if (!currentFile && (!nextFile.name || !nextFile.kind)) {
    throw new Error(`Cannot update unknown file: ${changes.id}`)
  }

  if (currentFile?.path && currentFile.path !== nextFile.path) {
    deletePathEntry(currentFile.path)
  }

  setFileObject(nextFile.id, nextFile)
  if (nextFile.path) {
    setFileObjectByPath(nextFile.path, nextFile)
  }
  return nextFile
}

export const createUntitledFile = (): IFile => {
  return createFile()
}

const readDirectoryEntries = async (
  folderPath: string,
  rootPath = folderPath,
): Promise<DirectoryReadEntry[]> => {
  const result = await invoke<DirectoryReadResult>('open_folder_async', {
    folderPath,
    rootPath,
    fileExcludePatterns: getCurrentFileExcludePatterns(),
  })

  return unwrapDirectoryReadResult(result)
}

export const readDirectory = async (folderPath: string): Promise<IFile[]> => {
  try {
    const entries = hydrateDirectoryEntries(await readDirectoryEntries(folderPath))

    const folderName = await invoke<string>('get_path_name', {
      path: folderPath,
    })

    const root: IFile = {
      id: getFileObjectByPath(folderPath)?.id || nanoid(),
      name: folderName,
      path: folderPath,
      kind: 'dir',
      children: entries,
    }

    setFileObjectByPath(folderPath, root)
    setFileObject(root.id, root)

    return [root]
  } catch (err) {
    throw new Error(`Failed to read directory: ${err}`)
  }
}

export const readSubdirectory = async (folderPath: string): Promise<IFile[]> => {
  try {
    const entries = hydrateDirectoryEntries(
      await readDirectoryEntries(folderPath, getFileExcludeRootPath(folderPath)),
    )

    return entries
  } catch (err) {
    return []
  }
}

const getCurrentFileExcludePatterns = () => {
  return resolveFileExcludePatterns(useAppSettingStore.getState().settingData)
}

const getFileExcludeRootPath = (folderPath: string) => {
  return useEditorStore.getState().getRootPath() || folderPath
}

export function isMdFile(fileName?: string) {
  if (!fileName) return false

  return fileName.endsWith('.md')
}

export function getFileNameFromPath(filePath: string) {
  if (filePath.endsWith('/')) {
    filePath = filePath.slice(0, -1)
  }

  const regex = /[\/\\]([^\/\\]+)$/
  const match = regex.exec(filePath)

  if (match && match.length > 1) {
    return match[1]
  }

  return filePath
}

export function getFolderPathFromPath(filePath?: string) {
  if (!filePath) return filePath

  const regex = /^(.*)[\/\\][^\/\\]+$/
  const match = regex.exec(filePath)

  if (match && match.length > 1) {
    return match[1]
  }

  return filePath
}

export function canvasDataToBinary(canvasData: string) {
  // Remove the data URL prefix (e.g., 'data:image/png;base64,')
  const data = canvasData.replace(/^data:image\/\w+;base64,/, '')

  // Decode the base64 data into binary format
  const binaryString = atob(data)

  // Create a Uint8Array from the binary string
  const length = binaryString.length
  const binaryArray = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    binaryArray[i] = binaryString.charCodeAt(i)
  }

  return binaryArray
}

export function getRelativePathWithCurWorkspace(filePath: string) {
  const rootPath = useEditorStore.getState().getRootPath()

  if (!rootPath || !filePath.startsWith(rootPath)) {
    return filePath
  }

  let relativePath = filePath.slice(rootPath.length)
  if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
    relativePath = relativePath.slice(1)
  }
  return relativePath
}

export async function getMdRelativePath(filePath: string, relativeTo: string) {
  if (!filePath || !relativeTo) {
    return filePath
  }

  const res = await invoke<{ code: FileResultCode; content: string }>('get_md_relative_path', {
    filePath,
    relativeTo,
  })

  if (res.code !== FileResultCode.Success) {
    return filePath
  }

  return res.content
}
