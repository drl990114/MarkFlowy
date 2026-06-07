import { useEditorStore } from '@/stores'
import type { FileEntry, IFile } from '@markflowy/interface'
import { FileResultCode } from '@markflowy/interface'
import { invoke } from '@tauri-apps/api/core'
import { readDir } from '@tauri-apps/plugin-fs'
import { nanoid } from 'nanoid'
import {
  getFileObjectByPath,
  setFileObject,
  setFileObjectByPath,
  setFileObjects,
  setFileObjectsByPath,
} from './files'

export { FileResultCode } from '@markflowy/interface'
export type { FileEntry, FileSysResult, IFile } from '@markflowy/interface'

// 安全范围管理已移至 Rust 后端（fc.rs），macOS 上 plugin-fs 的 start/stopAccessingSecurityScopedResource 为 no-op
export async function releaseSecurityScope(path?: string) {
  if (!path) return
  await invoke('release_security_scopes', { path })
}

const wrapFiles = (entries: FileEntry[]) => {
  const idEntries: Array<{ id: string; file: IFile }> = []
  const pathEntries: Array<{ path: string; file: IFile }> = []

  const visit = (items: FileEntry[]) => {
    items.forEach((entry) => {
      const file = entry as IFile
      file.id = getFileObjectByPath(entry.path)?.id || nanoid()

      idEntries.push({ id: file.id, file })
      if (entry.path) {
        pathEntries.push({ path: entry.path, file })
      }

      if (entry.children) {
        visit(entry.children)
      }
    })
  }

  visit(entries)
  setFileObjects(idEntries)
  setFileObjectsByPath(pathEntries)
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

export const updateFile = (file: IFile): IFile => {
  setFileObject(file.id, file)
  setFileObjectByPath(file.path!, file)
  return file
}

export const createUntitledFile = (): IFile => {
  return createFile()
}

export const readDirectory = async (folderPath: string): Promise<IFile[]> => {
  const entries: IFile[] = []
  
  try {
    const dirEntries = await readDir(folderPath)
    
    for (const entry of dirEntries) {
      const fileName = entry.name
      const filePath = `${folderPath}/${fileName}`
      const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : ''
      
      const isDir = entry.isDirectory
      
      const fileEntry: IFile = {
        id: nanoid(),
        name: fileName,
        kind: isDir ? 'dir' : 'file',
        path: filePath,
        children: isDir ? [] : undefined,
        ext: isDir ? '' : ext,
      }

      entries.push(fileEntry)
    }
    
    sortFilesByKindAndName(entries)
    wrapFiles(entries)
    
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

const sortFilesByKindAndName = (files: IFile[]) => {
  files.sort((a, b) => {
    if (a.kind === 'dir' && b.kind !== 'dir') return -1
    if (a.kind !== 'dir' && b.kind === 'dir') return 1
    return a.name.localeCompare(b.name, undefined, { numeric: true })
  })
}

export const readSubdirectory = async (folderPath: string): Promise<IFile[]> => {
  const entries: IFile[] = []
  
  try {
    const dirEntries = await readDir(folderPath)
    
    for (const entry of dirEntries) {
      const fileName = entry.name
      const filePath = `${folderPath}/${fileName}`
      const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : ''
      
      const isDir = entry.isDirectory
      
      const fileEntry: IFile = {
        id: nanoid(),
        name: fileName,
        kind: isDir ? 'dir' : 'file',
        path: filePath,
        children: isDir ? [] : undefined,
        ext: isDir ? '' : ext,
      }
      
      entries.push(fileEntry)
    }
    
    sortFilesByKindAndName(entries)
    wrapFiles(entries)
    
    return entries
  } catch (err) {
    return []
  }
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

  let res = await invoke<{ code: FileResultCode; content: string }>('get_md_relative_path', {
    filePath,
    relativeTo,
  })

  if (res.code !== FileResultCode.Success) {
    return filePath
  }

  return res.content
}
