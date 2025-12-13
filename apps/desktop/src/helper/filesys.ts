import { useEditorStore } from '@/stores'
import { invoke } from '@tauri-apps/api/core'
import { nanoid } from 'nanoid'
import { getFileObjectByPath, setFileObject, setFileObjectByPath } from './files'

interface FileEntry {
  name: string
  kind:
    | 'file'
    | 'dir'
    | 'pending_new_file'
    | 'pending_new_folder'
    | 'pending_edit_folder'
    | 'pending_edit_file'
    | 'new_tab'
  path?: string
  children?: IFile[]
  ext?: string
}

export interface IFile extends FileEntry {
  id: string
  content?: string
}

export enum FileResultCode {
  Success = 'Success',
  NotFound = 'NotFound',
  PermissionDenied = 'PermissionDenied',
  InvalidPath = 'InvalidPath',
  UnknownError = 'UnknownError',
}

export interface FileSysResult {
  code: FileResultCode
  content: string
}

const wrapFiles = (entries: FileEntry[]) => {
  entries.forEach((entry) => {
    ;(entry as IFile).id = getFileObjectByPath(entry.path)?.id || nanoid()

    setFileObject((entry as IFile).id, entry as IFile)
    setFileObjectByPath(entry.path!, entry as IFile)

    if (entry.children) {
      wrapFiles(entry.children)
    }
  })
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

export const readDirectory = (folderPath: string): Promise<IFile[]> => {
  return new Promise(async (resolve, reject) => {
    
    invoke<FileSysResult>('open_folder_async', { folderPath })
      .then(async (message) => {
        if (message.code !== FileResultCode.Success) {
          return
        }
        const mess = message.content
        const files = JSON.parse(mess)
        const entries: IFile[] = []

        if (!files || !files.length) {
          resolve([
            {
              id: nanoid(),
              name: getFileNameFromPath(folderPath),
              path: folderPath,
              kind: 'dir',
              children: entries,
            },
          ])
          return
        }

        for (let i = 0; i < files.length; i++) {
          const file = files[i]

          entries.push(file)
        }

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

        resolve([root])
      })
      .catch((err) => {
        reject(err)
      })
  })
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
