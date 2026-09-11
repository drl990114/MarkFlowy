import { getFileObject, getFileObjectByPath, getFileIdsByPathIdentity } from '@/helper/files'
import { createFile, type IFile } from '@/helper/filesys'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import useEditorStore from '@/stores/useEditorStore'
import useRecentFilesStore, { getRecentFileKey } from '@/stores/useRecentFilesStore'
import { invoke } from '@tauri-apps/api/core'
import { defaultFilter } from 'cmdk'

export interface QuickOpenFile {
  id: string
  name: string
  path?: string
  relativePath: string
  ext?: string
  fileId?: string
}

interface SearchFile {
  name: string
  path: string
  relative_path: string
  ext: string
  is_folder: boolean
}

function relativePath(path: string, rootPath?: string): string {
  if (!rootPath) return path
  const root = getPathIdentityKey(rootPath)
  const prefix = root.endsWith('/') ? root : `${root}/`
  return getPathIdentityKey(path).startsWith(prefix) ? path.slice(prefix.length) : path
}

export function getOpenedQuickOpenFiles(rootPath?: string): QuickOpenFile[] {
  const { opened, activeId } = useEditorStore.getState()
  const ids = activeId ? [activeId, ...opened.filter((id) => id !== activeId)] : opened
  return ids.flatMap((id) => {
    const file = getFileObject(id)
    if (!file || file.kind !== 'file') return []
    return [
      {
        id: file.path ? `path:${getPathIdentityKey(file.path)}` : `file:${id}`,
        name: file.name,
        path: file.path,
        relativePath: file.path ? relativePath(file.path, rootPath) : '',
        ext: file.ext,
        fileId: id,
      },
    ]
  })
}

export function getRecentQuickOpenFiles(rootPath?: string): QuickOpenFile[] {
  const history = useRecentFilesStore.getState()
  if (history.rootPath !== rootPath) return []
  const opened = new Map(getOpenedQuickOpenFiles(rootPath).map((file) => [file.id, file]))
  return history.entries.flatMap((entry) => {
    const id = getRecentFileKey(entry)
    const liveFile = opened.get(id)
    if (liveFile) return [liveFile]
    if (!entry.path) return []
    const name = entry.path.replace(/\\/g, '/').split('/').pop() || entry.path
    return [
      {
        id,
        name,
        path: entry.path,
        relativePath: relativePath(entry.path, rootPath),
        ext: name.includes('.') ? name.split('.').pop() : '',
      },
    ]
  })
}

/** Unavailable history is hidden for this popup only; failures never erase history. */
export async function checkRecentQuickOpenFiles(
  files: readonly QuickOpenFile[],
  signal: AbortSignal,
  onUnavailable: (id: string) => void,
): Promise<void> {
  const closedFiles = files.filter((file) => file.path && !file.fileId)
  let nextIndex = 0
  const worker = async () => {
    while (!signal.aborted && nextIndex < closedFiles.length) {
      const file = closedFiles[nextIndex++]
      let exists = false
      try {
        exists = await invoke<boolean>('file_exists', { filePath: file.path })
      } catch {
        // A disconnected volume or permission error is not evidence of deletion.
      }
      if (
        !signal.aborted &&
        !exists &&
        !getOpenedQuickOpenFiles().some((open) => open.id === file.id)
      ) {
        onUnavailable(file.id)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, closedFiles.length) }, worker))
}

export async function loadQuickOpenFiles(
  rootPath: string,
  fileExcludePatterns: string,
): Promise<QuickOpenFile[]> {
  // A name-only scan reaches unopened directories without reading any content.
  // Keep traversal, gitignore and user exclusions in the existing search backend.
  const result = await invoke<{ data: SearchFile[] }>('search_files_async', {
    query: { dir: rootPath, name_text: '.*', contents_text: '' },
    options: { file_exclude_patterns: fileExcludePatterns },
  })
  return result.data
    .filter((file) => !file.is_folder)
    .map((file) => ({
      id: `path:${getPathIdentityKey(file.path)}`,
      name: file.name,
      path: file.path,
      relativePath: file.relative_path,
      ext: file.ext,
    }))
}

export function mergeQuickOpenFiles(...sources: readonly QuickOpenFile[][]): QuickOpenFile[] {
  const files = new Map<string, QuickOpenFile>()
  for (const file of sources.flat()) {
    if (!files.has(file.id)) files.set(file.id, file)
  }
  return [...files.values()]
}

export function rankQuickOpenFiles(
  files: QuickOpenFile[],
  query: string,
  recentIds: readonly string[] = [],
): QuickOpenFile[] {
  const search = query.trim().replace(/\\/g, '/')
  const recency = new Map(recentIds.map((id, index) => [id, index]))
  return files
    .map((file) => ({
      file,
      score: search
        ? Math.max(
            defaultFilter(file.name, search),
            defaultFilter(file.relativePath.replace(/\\/g, '/'), search) * 0.9,
          )
        : 1,
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (recency.get(a.file.id) ?? recentIds.length) -
          (recency.get(b.file.id) ?? recentIds.length) ||
        Number(Boolean(b.file.fileId)) - Number(Boolean(a.file.fileId)) ||
        a.file.relativePath.localeCompare(b.file.relativePath),
    )
    .map(({ file }) => file)
}

export function openQuickOpenFile(entry: QuickOpenFile): IFile | undefined {
  const state = useEditorStore.getState()
  const knownFile =
    (entry.fileId ? getFileObject(entry.fileId) : undefined) ??
    (entry.path
      ? (getFileObjectByPath(entry.path) ??
        getFileObject(getFileIdsByPathIdentity(entry.path)[0]) ??
        state.getFileNodeByPath(entry.path))
      : undefined)
  if (knownFile?.kind === 'dir' || (!knownFile && !entry.path)) return

  // Reuse the cached object, including unsaved content. TextEditor owns loading.
  const file = knownFile
    ? (getFileObject(knownFile.id) ?? createFile(knownFile))
    : createFile({ name: entry.name, path: entry.path, ext: entry.ext })
  state.addOpenedFile(file.id)
  state.setActiveId(file.id)
  return file
}
