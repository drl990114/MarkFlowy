import type { IFile } from './filesys'

type IEntries = Record<string, IFile>;

const entries: IEntries = {}

export function setFileObject(id: string, file: IFile): void {
  entries[id] = file
}

export function getFileObject(id: string): IFile {
  return entries[id]
}
