import { create } from 'zustand'
import type { IFile } from '@/helper/filesys'
import { logger } from '@/helper/logger'

interface FileCacheState {
  entries: Record<string, IFile>
  pathEntries: Record<string, IFile>
}

const useFileCacheStore = create<FileCacheState>(() => ({
  entries: {},
  pathEntries: {},
}))

export function setFileObject(id: string, file: IFile): void {
  useFileCacheStore.setState((state) => ({
    entries: { ...state.entries, [id]: file },
  }))
}

export function getFileObject(id: string): IFile {
  return useFileCacheStore.getState().entries[id]
}

export function updateFileObject(id: string, file: IFile): void {
  setFileObject(id, file)
}

export function setFileObjectByPath(path: string, file: IFile): void {
  logger.info('[files] setFileObjectByPath', { path, name: file.name, ext: file.ext })
  useFileCacheStore.setState((state) => ({
    pathEntries: { ...state.pathEntries, [path]: file },
  }))
}

export function getFileObjectByPath(path?: string): undefined | IFile {
  if (!path) return undefined
  return useFileCacheStore.getState().pathEntries[path]
}

export function deletePathEntry(path: string): void {
  useFileCacheStore.setState((state) => {
    const { [path]: _, ...rest } = state.pathEntries
    return { pathEntries: rest }
  })
}

export const saveOpenedEditorEntries: Record<string, () => Promise<void>> = {}

export function setSaveOpenedEditorEntries(id: string, saveHandler: () => Promise<void>): void {
  saveOpenedEditorEntries[id] = saveHandler
}

export function getSaveOpenedEditorEntries(id: string): (() => void) | undefined {
  return saveOpenedEditorEntries[id]
}

export function delSaveOpenedEditorEntries(id: string): void {
  delete saveOpenedEditorEntries[id]
}

export default useFileCacheStore