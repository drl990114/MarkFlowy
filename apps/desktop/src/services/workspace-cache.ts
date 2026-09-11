import useFileCacheStore, { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile, getFileNameFromPath } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import useEditorStore, { type EditorLayoutNode } from '@/stores/useEditorStore'
import useRecentFilesStore, { parseRecentFilePaths } from '@/stores/useRecentFilesStore'
import type { LazyStore } from '@tauri-apps/plugin-store'
import { nanoid } from 'nanoid'
import { restoreRecentFileHistory, startRecentFileTracking } from './recent-files'

type PersistedEditorLayoutNode =
  | {
      type: 'branch'
      id?: string
      direction: 'horizontal' | 'vertical'
      sizes?: number[]
      children: PersistedEditorLayoutNode[]
    }
  | {
      type: 'leaf'
      id?: string
      openedFilePaths?: string[]
      activeFilePath?: string
    }

export interface WorkspaceCache {
  recentFilePaths?: string[]
  version?: number
  openedFilePaths?: string[]
  activeFilePath?: string
  editorLayout?: PersistedEditorLayoutNode
  activeGroupId?: string
}

type EditorStoreSnapshot = ReturnType<typeof useEditorStore.getState>

type WorkspaceCacheDraft = {
  activeGroupId?: string
  activeId?: string
  editorLayout: EditorLayoutNode
  openedFiles: {
    id: string
    name?: string
    path?: string
  }[]
  rootPath?: string
  recentFilePaths: string[]
}

export type WorkspaceCachePersistence = {
  dispose: () => Promise<void>
  flush: () => Promise<void>
  getWorkspaceCache: (path: string) => Promise<WorkspaceCache | undefined>
}

const WORKSPACE_CACHE_SAVE_DEBOUNCE_MS = 800

const getExtFromPath = (path: string) => {
  const fileName = getFileNameFromPath(path) || ''
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > -1 ? fileName.slice(dotIndex + 1) : ''
}

const ensureCachedFileByPath = (path: string) => {
  const existingFile = getFileObjectByPath(path)
  if (existingFile) {
    return existingFile
  }

  return createFile({
    name: getFileNameFromPath(path) || 'new-file.md',
    ext: getExtFromPath(path),
    path,
  })
}

const serializeEditorLayout = (
  node: EditorLayoutNode,
  filePathsById: ReadonlyMap<string, string | undefined>,
): PersistedEditorLayoutNode => {
  if (node.type === 'leaf') {
    return {
      type: 'leaf',
      id: node.id,
      openedFilePaths: node.opened
        .map((fileId) => filePathsById.get(fileId))
        .filter((path): path is string => Boolean(path)),
      activeFilePath: node.activeId ? filePathsById.get(node.activeId) : undefined,
    }
  }

  return {
    type: 'branch',
    id: node.id,
    direction: node.direction,
    sizes: node.sizes,
    children: node.children.map((child) => serializeEditorLayout(child, filePathsById)),
  }
}

const selectWorkspaceCacheDraft = (state: EditorStoreSnapshot): WorkspaceCacheDraft => {
  const openedFiles = state.opened.map((id) => {
    const file = getFileObject(id)

    return {
      id,
      name: file?.name,
      path: file?.path,
    }
  })

  return {
    activeGroupId: state.activeGroupId,
    activeId: state.activeId,
    editorLayout: state.editorLayout,
    openedFiles,
    rootPath: state.getRootPath(),
    recentFilePaths:
      useRecentFilesStore.getState().rootPath === state.getRootPath()
        ? useRecentFilesStore
            .getState()
            .entries.flatMap((entry) => (entry.path ? [entry.path] : []))
        : [],
  }
}

const isSameOpenedFiles = (
  prev: WorkspaceCacheDraft['openedFiles'],
  next: WorkspaceCacheDraft['openedFiles'],
) => {
  if (prev === next) return true
  if (prev.length !== next.length) return false

  return prev.every((file, index) => {
    const nextFile = next[index]
    return file.id === nextFile.id && file.name === nextFile.name && file.path === nextFile.path
  })
}

const isSameWorkspaceCacheDraft = (prev: WorkspaceCacheDraft, next: WorkspaceCacheDraft) => {
  return (
    prev.activeGroupId === next.activeGroupId &&
    prev.activeId === next.activeId &&
    prev.editorLayout === next.editorLayout &&
    prev.rootPath === next.rootPath &&
    isSameOpenedFiles(prev.openedFiles, next.openedFiles) &&
    prev.recentFilePaths.length === next.recentFilePaths.length &&
    prev.recentFilePaths.every((path, index) => path === next.recentFilePaths[index])
  )
}

const persistWorkspaceCache = async (
  cacheStore: LazyStore,
  {
    activeGroupId,
    activeId,
    editorLayout,
    openedFiles,
    rootPath,
    recentFilePaths,
  }: WorkspaceCacheDraft,
) => {
  if (!rootPath) return

  const openedFilePaths = openedFiles
    .map((file) => file.path)
    .filter((path): path is string => Boolean(path))
  const filePathsById = new Map(openedFiles.map((file) => [file.id, file.path]))

  await cacheStore.set(rootPath, {
    version: 2,
    recentFilePaths,
    openedFilePaths,
    activeFilePath: activeId ? filePathsById.get(activeId) || '' : '',
    editorLayout: serializeEditorLayout(editorLayout, filePathsById),
    activeGroupId,
  })
  await cacheStore.save()
}

export const createWorkspaceCachePersistence = (
  cacheStore: LazyStore,
): WorkspaceCachePersistence => {
  const stopTracking = startRecentFileTracking()
  let cacheSaveTimer: number | undefined
  let isDisposed = false
  let latestDraft = selectWorkspaceCacheDraft(useEditorStore.getState())
  let pendingDraft: WorkspaceCacheDraft | undefined
  let saveQueue = Promise.resolve()

  const clearSaveTimer = () => {
    if (cacheSaveTimer === undefined) return

    window.clearTimeout(cacheSaveTimer)
    cacheSaveTimer = undefined
  }

  const enqueueSave = (cacheDraft: WorkspaceCacheDraft) => {
    saveQueue = saveQueue
      .then(() => persistWorkspaceCache(cacheStore, cacheDraft))
      .catch((error) => {
        logger.error('Failed to persist workspace cache', cacheDraft.rootPath, error)
      })
  }

  const enqueuePendingDraft = () => {
    clearSaveTimer()
    if (!pendingDraft) return

    const cacheDraft = pendingDraft
    pendingDraft = undefined
    enqueueSave(cacheDraft)
  }

  const scheduleSave = (cacheDraft: WorkspaceCacheDraft) => {
    if (isDisposed) return

    if (pendingDraft && pendingDraft.rootPath !== cacheDraft.rootPath) {
      enqueuePendingDraft()
    }

    pendingDraft = cacheDraft
    clearSaveTimer()
    cacheSaveTimer = window.setTimeout(() => {
      enqueuePendingDraft()
    }, WORKSPACE_CACHE_SAVE_DEBOUNCE_MS)
  }

  const handleDraftChange = (cacheDraft: WorkspaceCacheDraft) => {
    if (
      useRecentFilesStore.getState().restoring ||
      isSameWorkspaceCacheDraft(latestDraft, cacheDraft)
    )
      return

    latestDraft = cacheDraft
    scheduleSave(cacheDraft)
  }

  const unsubscribeEditorStore = useEditorStore.subscribe(
    selectWorkspaceCacheDraft,
    handleDraftChange,
    { equalityFn: isSameWorkspaceCacheDraft },
  )
  const unsubscribeFileCache = useFileCacheStore.subscribe((state, previousState) => {
    if (state.metadataRevision === previousState.metadataRevision) return

    handleDraftChange(selectWorkspaceCacheDraft(useEditorStore.getState()))
  })

  const unsubscribeRecentFiles = useRecentFilesStore.subscribe(() => {
    handleDraftChange(selectWorkspaceCacheDraft(useEditorStore.getState()))
  })

  const flush = async () => {
    enqueuePendingDraft()
    await saveQueue
  }

  const getWorkspaceCache = (path: string) => {
    enqueuePendingDraft()
    const result = saveQueue.then(() => cacheStore.get<WorkspaceCache>(path))
    saveQueue = result
      .then(() => undefined)
      .catch((error) => {
        logger.error('Failed to load workspace cache', path, error)
      })
    return result
  }

  return {
    flush,
    getWorkspaceCache,
    dispose: async () => {
      if (isDisposed) return

      isDisposed = true
      unsubscribeEditorStore()
      unsubscribeFileCache()
      unsubscribeRecentFiles()
      stopTracking()
      await flush()
      try {
        await cacheStore.close()
      } catch (error) {
        logger.error('Failed to close workspace cache store', error)
      }
    },
  }
}

const hydrateEditorLayout = (node: PersistedEditorLayoutNode): EditorLayoutNode => {
  if (node.type === 'leaf') {
    const opened = (node.openedFilePaths || []).map((path) => ensureCachedFileByPath(path).id)
    const activeId = node.activeFilePath
      ? ensureCachedFileByPath(node.activeFilePath).id
      : opened[0]

    return {
      type: 'leaf',
      id: node.id || nanoid(),
      opened,
      activeId,
    }
  }

  const children = node.children.map(hydrateEditorLayout)
  const sizes =
    node.sizes?.length === children.length
      ? node.sizes
      : children.map(() => 100 / Math.max(children.length, 1))

  return {
    type: 'branch',
    id: node.id || nanoid(),
    direction: node.direction,
    sizes,
    children,
  }
}

type HydratedWorkspaceCache =
  | {
      activeGroupId?: string
      editorLayout: EditorLayoutNode
      openedIds?: never
      activeId?: never
    }
  | {
      activeId?: string
      openedIds: string[]
      activeGroupId?: never
      editorLayout?: never
    }

const hydrateWorkspaceCache = (
  workspaceCache?: WorkspaceCache,
): HydratedWorkspaceCache | undefined => {
  if (!workspaceCache) return undefined

  const { openedFilePaths, activeFilePath, editorLayout, activeGroupId } = workspaceCache

  if (editorLayout) {
    return {
      activeGroupId,
      editorLayout: hydrateEditorLayout(editorLayout),
    }
  }

  if (!openedFilePaths) return undefined

  const openedIds = openedFilePaths.map((path) => ensureCachedFileByPath(path).id)
  const activeId = activeFilePath ? ensureCachedFileByPath(activeFilePath).id : undefined

  return { activeId, openedIds }
}

const applyHydratedWorkspaceCache = (workspaceCache?: HydratedWorkspaceCache) => {
  if (!workspaceCache) return

  const { addOpenedFile, setActiveId, setEditorLayout } = useEditorStore.getState()
  if (workspaceCache.editorLayout) {
    setEditorLayout(workspaceCache.editorLayout, workspaceCache.activeGroupId)
    return
  }

  workspaceCache.openedIds.forEach(addOpenedFile)

  if (workspaceCache.activeId) {
    addOpenedFile(workspaceCache.activeId)
    setActiveId(workspaceCache.activeId)
  }
}

export function restoreWorkspaceCache(
  workspaceCache: WorkspaceCache | undefined,
  folderData: EditorStoreSnapshot['folderData'],
): void {
  restoreRecentFileHistory(
    () => {
      const hydrated = hydrateWorkspaceCache(workspaceCache)
      useEditorStore.getState().setFolderData(folderData)
      applyHydratedWorkspaceCache(hydrated)
    },
    workspaceCache?.recentFilePaths === undefined
      ? undefined
      : parseRecentFilePaths(workspaceCache.recentFilePaths),
  )
}
