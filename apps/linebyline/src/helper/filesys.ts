import WELCOMECONTENT from '@/constants/welcomeContent'
import { invoke } from '@tauri-apps/api'
import { nanoid } from 'nanoid'
import { setFileObject, setFileObjectByPath } from './files'

interface FileEntry {
  name: string
  kind: 'file' | 'dir'
  path?: string
  children?: IFile[]
}

export interface IFile extends FileEntry {
  id: string
  content?: string
}

const wrapFiles = (entries: FileEntry[]) => {
  entries.forEach((entry) => {
    ;(entry as IFile).id = nanoid()

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
    content: '',
    ...opt,
  }

  setFileObject(file.id, file)

  if (file.path) {
    setFileObjectByPath(file.path, file)
  }
  return file
}
export const createWelcomeFile = (): IFile => {
  return createFile({
    name: 'Welcome.md',
    content: WELCOMECONTENT,
  })
}

export const createUntitledFile = (): IFile => {
  return createFile()
}

export const readDirectory = (folderPath: string): Promise<IFile[]> => {
  return new Promise((resolve, reject) => {
    invoke('open_folder', { folderPath })
      .then((message: unknown) => {
        const mess = message as string
        const files = JSON.parse(mess.replaceAll('\\', '/').replaceAll('//', '/'))
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

        resolve([
          {
            id: nanoid(),
            name: getFileNameFromPath(folderPath),
            path: folderPath,
            kind: 'dir',
            children: entries,
          },
        ])
      })
      .catch((err) => {
        reject(err)
      })
  })
}

export function isMdFile(fileName: string) {
  return fileName.endsWith('.md')
}

function getFileNameFromPath(filePath: string) {
  const regex = /[\/\\]([^\/\\]+)$/
  const match = regex.exec(filePath)

  if (match && match.length > 1) {
    return match[1]
  }

  return filePath
}
