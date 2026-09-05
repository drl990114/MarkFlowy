import { create } from 'zustand'
import { shallow } from 'zustand/vanilla/shallow'
import type { IFile } from '@/helper/filesys'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import {
  findPathCollisions,
  type PathRelationResolver,
} from '@/helper/physicalPathIdentity'

interface FileCacheState {
  entries: Record<string, IFile>
  metadataRevision: number
  pathEntries: Record<string, IFile>
}

const useFileCacheStore = create<FileCacheState>(() => ({
  entries: {},
  metadataRevision: 0,
  pathEntries: {},
}))

const hasFileMetadataChanged = (previousFile: IFile | undefined, nextFile: IFile) => {
  return previousFile?.name !== nextFile.name || previousFile?.path !== nextFile.path
}

const trimTrailingSeparators = (path: string) => {
  if (path === '/' || /^[A-Za-z]:[\\/]$/.test(path)) return path
  return path.replace(/[\\/]+$/, '')
}

const rebasePath = (path: string | undefined, oldRootPath: string, newRootPath: string) => {
  if (!path) return undefined
  const oldRoot = trimTrailingSeparators(oldRootPath)
  const newRoot = trimTrailingSeparators(newRootPath)
  const isWindowsPath =
    /^[A-Za-z]:[\\/]/.test(path) ||
    /^[A-Za-z]:[\\/]/.test(oldRoot) ||
    path.startsWith('\\\\') ||
    oldRoot.startsWith('\\\\')
  const comparablePath = isWindowsPath ? path.toLowerCase() : path
  const comparableRoot = isWindowsPath ? oldRoot.toLowerCase() : oldRoot

  if (comparablePath === comparableRoot) return newRoot
  if (!comparablePath.startsWith(comparableRoot)) return undefined

  const separator = path.charAt(oldRoot.length)
  if (separator !== '/' && separator !== '\\') return undefined

  return `${newRoot}${path.slice(oldRoot.length)}`
}

export function setFileObject(id: string, file: IFile): void {
  useFileCacheStore.setState((state) => {
    const previousFile = state.entries[id]
    // Sibling editors can publish the same snapshot. Compare every file field
    // so metadata and children updates still propagate with unchanged content.
    if (shallow(previousFile, file)) return state

    return {
      entries: { ...state.entries, [id]: file },
      metadataRevision:
        state.metadataRevision + (hasFileMetadataChanged(previousFile, file) ? 1 : 0),
    }
  })
}

export function setFileObjects(files: Array<{ id: string; file: IFile }>): void {
  if (files.length === 0) return
  useFileCacheStore.setState((state) => {
    const entries = { ...state.entries }
    let hasMetadataChange = false
    for (const { id, file } of files) {
      hasMetadataChange ||= hasFileMetadataChanged(entries[id], file)
      entries[id] = file
    }
    return {
      entries,
      metadataRevision: state.metadataRevision + (hasMetadataChange ? 1 : 0),
    }
  })
}

export function getFileObject(id: string): IFile {
  return useFileCacheStore.getState().entries[id]
}

export function getFileObjects(): IFile[] {
  return Object.values(useFileCacheStore.getState().entries)
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

export function getFileIdsByPathPrefix(rootPath: string): string[] {
  return Object.entries(useFileCacheStore.getState().entries)
    .filter(([, file]) => rebasePath(file.path, rootPath, rootPath) !== undefined)
    .map(([id]) => id)
}

export function getFileIdsByPathIdentity(path: string): string[] {
  const identity = getPathIdentityKey(path)
  return Object.entries(useFileCacheStore.getState().entries)
    .filter(([, file]) => !!file.path && getPathIdentityKey(file.path) === identity)
    .map(([id]) => id)
}

/** Resolve the real cached directory entry behind a replacement request, including descendants. */
export async function getReplacementTargetIds(
  targetPath: string,
  compare?: PathRelationResolver,
): Promise<string[]> {
  const collisions = compare
    ? await findPathCollisions(targetPath, getFileObjects(), compare)
    : await findPathCollisions(targetPath, getFileObjects())
  const targetIds = new Set<string>()

  collisions.replaceFiles.forEach((file) => {
    targetIds.add(file.id)
    if (!file.path) return
    getFileIdsByPathPrefix(file.path).forEach((id) => targetIds.add(id))
  })

  return [...targetIds]
}

export function deletePathEntry(path: string): void {
  useFileCacheStore.setState((state) => {
    const { [path]: _, ...rest } = state.pathEntries
    return { pathEntries: rest }
  })
}

/** Remove one cached file and every path alias that still points to its id. */
export function deleteFileObject(id: string): IFile | undefined {
  let deletedFile: IFile | undefined

  useFileCacheStore.setState((state) => {
    deletedFile = state.entries[id]
    const entries = { ...state.entries }
    const pathEntries = { ...state.pathEntries }
    let changed = false

    if (entries[id]) {
      delete entries[id]
      changed = true
    }

    for (const [path, file] of Object.entries(pathEntries)) {
      if (file.id !== id) continue
      delete pathEntries[path]
      changed = true
    }

    if (!changed) return state

    return {
      entries,
      metadataRevision: state.metadataRevision + (deletedFile ? 1 : 0),
      pathEntries,
    }
  })

  return deletedFile
}

/** Remove cached files by physical replacement ids and clear every path alias to those ids. */
export function deleteFileObjectsByIds(fileIds: string[]): string[] {
  const requestedIds = new Set(fileIds.filter(Boolean))
  if (requestedIds.size === 0) return []

  const deletedIds: string[] = []
  useFileCacheStore.setState((state) => {
    const entries = { ...state.entries }
    const pathEntries = { ...state.pathEntries }

    requestedIds.forEach((id) => {
      if (!entries[id]) return
      delete entries[id]
      deletedIds.push(id)
    })
    Object.entries(pathEntries).forEach(([path, file]) => {
      if (requestedIds.has(file.id)) delete pathEntries[path]
    })

    if (deletedIds.length === 0 && Object.keys(pathEntries).length === Object.keys(state.pathEntries).length) {
      return state
    }

    return {
      entries,
      metadataRevision: state.metadataRevision + (deletedIds.length > 0 ? 1 : 0),
      pathEntries,
    }
  })

  return deletedIds
}

/**
 * Keep every cached descendant in sync after moving or renaming a folder.
 * This also covers opened files whose lazy-loaded tree node is no longer mounted.
 */
export function moveFileObjectsByPathPrefix(oldRootPath: string, newRootPath: string): void {
  useFileCacheStore.setState((state) => {
    const entries = { ...state.entries }
    const pathEntries = { ...state.pathEntries }
    const movedIds = new Set<string>()
    let hasChanges = false

    for (const [id, file] of Object.entries(state.entries)) {
      const nextPath = rebasePath(file.path, oldRootPath, newRootPath)
      if (!nextPath || nextPath === file.path) continue

      const nextFile = { ...file, path: nextPath }
      entries[id] = nextFile
      if (file.path) {
        delete pathEntries[file.path]
      }
      pathEntries[nextPath] = nextFile
      movedIds.add(id)
      hasChanges = true
    }

    for (const [path, file] of Object.entries(state.pathEntries)) {
      const nextPath = rebasePath(path, oldRootPath, newRootPath)
      if (!nextPath || nextPath === path || movedIds.has(file.id)) continue

      const nextFile = { ...file, ...entries[file.id], path: nextPath }
      delete pathEntries[path]
      pathEntries[nextPath] = nextFile
      if (entries[file.id]) {
        entries[file.id] = nextFile
      }
      hasChanges = true
    }

    if (!hasChanges) return state

    const relinkedFiles = new Map<string, IFile>()
    const relinkChildren = (file: IFile): IFile => {
      const cachedFile = entries[file.id] ?? file
      const existing = relinkedFiles.get(cachedFile.id)
      if (existing) return existing

      const nextPath = rebasePath(cachedFile.path, oldRootPath, newRootPath)
      const pathUpdatedFile =
        nextPath && nextPath !== cachedFile.path ? { ...cachedFile, path: nextPath } : cachedFile
      const children = pathUpdatedFile.children?.map(relinkChildren)
      const nextFile =
        children && children.some((child, index) => child !== pathUpdatedFile.children?.[index])
          ? { ...pathUpdatedFile, children }
          : pathUpdatedFile

      relinkedFiles.set(nextFile.id, nextFile)
      if (entries[nextFile.id]) {
        entries[nextFile.id] = nextFile
      }
      return nextFile
    }

    Object.values(entries).forEach(relinkChildren)
    Object.values(entries).forEach((file) => {
      if (file.path) pathEntries[file.path] = file
    })

    return {
      entries,
      metadataRevision: state.metadataRevision + 1,
      pathEntries,
    }
  })
}

/** Remove a replaced file/folder and all cached descendants, returning their ids. */
export function deleteFileObjectsByPathPrefix(rootPath: string): string[] {
  const deletedIds: string[] = []

  useFileCacheStore.setState((state) => {
    const entries = { ...state.entries }
    const pathEntries = { ...state.pathEntries }

    for (const [id, file] of Object.entries(state.entries)) {
      if (rebasePath(file.path, rootPath, rootPath) === undefined) continue

      deletedIds.push(id)
      delete entries[id]
    }

    for (const path of Object.keys(state.pathEntries)) {
      if (rebasePath(path, rootPath, rootPath) !== undefined) {
        delete pathEntries[path]
      }
    }

    if (
      deletedIds.length === 0 &&
      Object.keys(pathEntries).length === Object.keys(state.pathEntries).length
    ) {
      return state
    }

    return {
      entries,
      metadataRevision: state.metadataRevision + (deletedIds.length > 0 ? 1 : 0),
      pathEntries,
    }
  })

  return deletedIds
}

export const saveOpenedEditorEntries: Record<string, () => Promise<boolean>> = {}

export function setSaveOpenedEditorEntries(id: string, saveHandler: () => Promise<boolean>): void {
  saveOpenedEditorEntries[id] = saveHandler
}

export function getSaveOpenedEditorEntries(id: string): (() => Promise<boolean>) | undefined {
  return saveOpenedEditorEntries[id]
}

export function delSaveOpenedEditorEntries(id: string): void {
  delete saveOpenedEditorEntries[id]
}

export default useFileCacheStore
