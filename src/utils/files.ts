import { IFile } from "./filesys"

interface IEntries {
  [key: string]: IFile
}

const entries: IEntries = {}

export const setFileObject = (id: string, file: IFile): void => {
  entries[id] = file
}

export const getFileObject = (id: string): IFile => {
  return entries[id]
}

