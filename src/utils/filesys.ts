import { invoke } from '@tauri-apps/api'
import { nanoid } from 'nanoid'
import { setFileObject } from './files'
import WELCOMECONTENT from '@/constants/welcomeContent'

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
    ...opt,
  }

  setFileObject(file.id, file)

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
    invoke('open_folder', { folderPath }).then((message: unknown) => {
      const mess = message as string
      const files = JSON.parse(mess.replaceAll('\\', '/').replaceAll('//', '/'))
      const entries: IFile[] = []

      if (!files || !files.length) {
        resolve(entries)
        return
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const entry: FileEntry = {
          kind: file.kind,
          name: file.name,
          path: file.path,
          children: file.kind === 'dir' ? file.children : undefined,
        }

        entries.push(file)
      }

      wrapFiles(entries)
      console.log('files', entries)
      resolve(entries)
    })
  })
}
