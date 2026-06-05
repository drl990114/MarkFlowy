import { create } from 'zustand'
import type { IFile } from '@/helper/filesys'

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

export function setFileObjects(files: Array<{ id: string; file: IFile }>): void {
  if (files.length === 0) return
  useFileCacheStore.setState((state) => {
    const entries = { ...state.entries }
    for (const { id, file } of files) {
      entries[id] = file
    }
    return { entries }
  })
}

export function getFileObject(id: string): IFile {
  return useFileCacheStore.getState().entries[id]
}

export function updateFileObject(id: string, file: IFile): void {
  setFileObject(id, file)
}

export function setFileObjectByPath(path: string, file: IFile): void {
  useFileCacheStore.setState((state) => ({
    pathEntries: { ...state.pathEntries, [path]: file },
  }))
}

export function setFileObjectsByPath(files: Array<{ path: string; file: IFile }>): void {
  if (files.length === 0) return
  useFileCacheStore.setState((state) => {
    const pathEntries = { ...state.pathEntries }
    for (const { path, file } of files) {
      pathEntries[path] = file
    }
    return { pathEntries }
  })
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
