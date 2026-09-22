import { invoke } from '@tauri-apps/api/core'
import { create } from 'zustand'
import { shallow } from 'zustand/vanilla/shallow'
import type { IFile } from '@/helper/filesys'
import { toFileMetadata } from './fileMetadata'
import { getPathIdentityKey, rebaseFilePath } from '@/helper/pathIdentity'
import useRecentFilesStore from '@/stores/useRecentFilesStore'
import { findPathCollisions, type PathRelationResolver } from '@/helper/physicalPathIdentity'
import { completeDeferredEditorSave, getDeferredEditorSave } from '@/components/EditorArea/deferredEditorSave'

interface FileCacheState {
  /** Metadata only; content updates leave this potentially large index intact. */
  entries: Record<string, IFile>
  contentEntries: Record<string, { metadata: IFile; file: IFile }>
  metadataRevision: number
  pathEntries: Record<string, IFile>
}

const useFileCacheStore = create<FileCacheState>(() => ({
  entries: {},
  contentEntries: {},
  metadataRevision: 0,
  pathEntries: {},
}))

const hasFileMetadataChanged = (previousFile: IFile | undefined, nextFile: IFile) => {
  return previousFile?.name !== nextFile.name || previousFile?.path !== nextFile.path
}

const rebasePath = (path: string | undefined, oldRootPath: string, newRootPath: string) => {
  return path ? rebaseFilePath(path, oldRootPath, newRootPath) : undefined
}

function resolveCachedFile(state: FileCacheState, id: string): IFile {
  const metadata = state.entries[id]
  const body = state.contentEntries[id]
  return body && body.metadata === metadata ? body.file : metadata
}

export function setFileObject(id: string, file: IFile): void {
  setFileObjects([{ id, file }])
}

export function setFileObjects(files: { id: string; file: IFile }[]): void {
  if (!files.length) return
  useFileCacheStore.setState((state) => {
    let entries = state.entries
    let contentEntries = state.contentEntries
    let hasMetadataChange = false
    for (const { id, file } of files) {
      const candidate = toFileMetadata(file)
      const metadata = shallow(entries[id], candidate) ? entries[id] : candidate
      hasMetadataChange ||= hasFileMetadataChanged(entries[id], file)
      if (entries[id] !== metadata) {
        if (entries === state.entries) entries = { ...entries }
        entries[id] = metadata
      }
      const body = contentEntries[id]
      if (typeof file.content === 'string') {
        if (body?.metadata === metadata && body.file.content === file.content) continue
        if (contentEntries === state.contentEntries) contentEntries = { ...contentEntries }
        contentEntries[id] = {
          metadata,
          file: file.children === metadata.children ? file : { ...metadata, content: file.content },
        }
      } else if (body) {
        if (contentEntries === state.contentEntries) contentEntries = { ...contentEntries }
        delete contentEntries[id]
      }
    }
    if (entries === state.entries && contentEntries === state.contentEntries) return state
    return {
      entries,
      contentEntries,
      metadataRevision: state.metadataRevision + (hasMetadataChange ? 1 : 0),
    }
  })
}

export function getFileObject(id: string): IFile {
  return resolveCachedFile(useFileCacheStore.getState(), id)
}

export function getFileObjects(): IFile[] {
  const state = useFileCacheStore.getState()
  return Object.keys(state.entries).map((id) => resolveCachedFile(state, id))
}

/** Call only after the last editor, save and draft-protection operation settles. */
export function releaseFileContent(id: string): void {
  useFileCacheStore.setState((state) => {
    if (!state.contentEntries[id]) return state
    const { [id]: _body, ...contentEntries } = state.contentEntries
    return { contentEntries }
  })
}

/** Run only after a workspace switch commits. Pending bodies outlive the old tree. */
export function pruneFileMetadata(rootPath: string | undefined, openedIds: readonly string[]): void {
  useFileCacheStore.setState((state) => {
    const retained = new Set([...openedIds, ...Object.keys(state.contentEntries)])
    const keep = (file: IFile) =>
      retained.has(file.id) ||
      !!(rootPath && rebasePath(file.path, rootPath, rootPath) !== undefined)
    const entries = Object.fromEntries(Object.entries(state.entries).filter(([, file]) => keep(file)))
    const pathEntries = Object.fromEntries(Object.entries(state.pathEntries).filter(([, file]) => keep(file)))
    if (
      Object.keys(entries).length === Object.keys(state.entries).length &&
      Object.keys(pathEntries).length === Object.keys(state.pathEntries).length
    ) return state
    return { entries, pathEntries, metadataRevision: state.metadataRevision + 1 }
  })
}

export function updateFileObject(id: string, file: IFile): void {
  setFileObject(id, file)
}

export function setFileObjectByPath(path: string, file: IFile): void {
  useFileCacheStore.setState((state) => ({
    pathEntries: { ...state.pathEntries, [path]: toFileMetadata(file) },
  }))
}

export function setFileObjectsByPath(files: { path: string; file: IFile }[]): void {
  if (files.length === 0) return
  useFileCacheStore.setState((state) => {
    const pathEntries = { ...state.pathEntries }
    for (const { path, file } of files) {
      pathEntries[path] = toFileMetadata(file)
    }
    return { pathEntries }
  })
}

export function getFileObjectByPath(path?: string): undefined | IFile {
  if (!path) return undefined
  const state = useFileCacheStore.getState()
  const metadata = state.pathEntries[path]
  return metadata ? resolveCachedFile(state, metadata.id) ?? metadata : undefined
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
    deletedFile = resolveCachedFile(state, id)
    const entries = { ...state.entries }
    const pathEntries = { ...state.pathEntries }
    const { [id]: _body, ...contentEntries } = state.contentEntries
    let changed = !!state.contentEntries[id]

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
      contentEntries,
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
    const contentEntries = { ...state.contentEntries }

    requestedIds.forEach((id) => {
      delete contentEntries[id]
      if (!entries[id]) return
      delete entries[id]
      deletedIds.push(id)
    })
    Object.entries(pathEntries).forEach(([path, file]) => {
      if (requestedIds.has(file.id)) delete pathEntries[path]
    })

    if (
      deletedIds.length === 0 &&
      Object.keys(contentEntries).length === Object.keys(state.contentEntries).length &&
      Object.keys(pathEntries).length === Object.keys(state.pathEntries).length
    ) {
      return state
    }

    return {
      entries,
      contentEntries,
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

    const contentEntries = { ...state.contentEntries }
    for (const [id, body] of Object.entries(contentEntries)) {
      if (body.metadata !== state.entries[id]) {
        delete contentEntries[id]
        continue
      }
      if (entries[id] !== body.metadata) {
        contentEntries[id] = {
          metadata: entries[id],
          file: { ...entries[id], content: body.file.content },
        }
      }
    }

    return {
      entries,
      contentEntries,
      metadataRevision: state.metadataRevision + 1,
      pathEntries,
    }
  })
  // Closed history may have no cached tree node, so migrate it independently.
  useRecentFilesStore.getState().rebasePaths(oldRootPath, newRootPath)
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    void invoke('local_history', {
      operation: 'rebase',
      payload: { oldPath: oldRootPath, newPath: newRootPath },
    }).catch((error) => console.error('History path update failed', error))
  }
}

/** Remove a replaced file/folder and all cached descendants, returning their ids. */
export function deleteFileObjectsByPathPrefix(rootPath: string): string[] {
  const deletedIds: string[] = []

  useFileCacheStore.setState((state) => {
    const entries = { ...state.entries }
    const pathEntries = { ...state.pathEntries }
    const contentEntries = { ...state.contentEntries }

    for (const [id, file] of Object.entries(state.entries)) {
      if (rebasePath(file.path, rootPath, rootPath) === undefined) continue

      deletedIds.push(id)
      delete entries[id]
      delete contentEntries[id]
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
      contentEntries,
      metadataRevision: state.metadataRevision + (deletedIds.length > 0 ? 1 : 0),
      pathEntries,
    }
  })

  useRecentFilesStore.getState().removePath(rootPath)

  return deletedIds
}

export const saveOpenedEditorEntries: Record<string, () => Promise<boolean>> = {}

export function setSaveOpenedEditorEntries(id: string, saveHandler: () => Promise<boolean>): void {
  saveOpenedEditorEntries[id] = saveHandler
  completeDeferredEditorSave(id, saveHandler)
}

export function getSaveOpenedEditorEntries(id: string): (() => Promise<boolean>) | undefined {
  return saveOpenedEditorEntries[id] ?? getDeferredEditorSave(id)
}

export function delSaveOpenedEditorEntries(id: string): void {
  delete saveOpenedEditorEntries[id]
}

export default useFileCacheStore
