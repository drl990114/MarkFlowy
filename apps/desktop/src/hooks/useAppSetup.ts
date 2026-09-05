import { commandRegistry } from '@/commands'
import {
  FILE_MUTATION_QUEUE_KEY,
  savePathCoordinator,
} from '@/components/EditorArea/savePathCoordinator'
import bus from '@/helper/eventBus'
import { loadLocalThemeCss } from '@/helper/extensions'
import { hasFileExcludePatternsChanged } from '@/helper/file-exclude'
import useFileCacheStore, { getFileObject, getFileObjectByPath } from '@/helper/files'
import {
  createFile,
  getFileNameFromPath,
  readDirectory,
  releaseSecurityScope,
} from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { checkUpdate } from '@/helper/updater'
import { i18nInit, t } from '@/i18n'
import { appSettingStoreSetup } from '@/services/app-setting'
import { guardUnsavedFilesAsync } from '@/services/checkUnsavedFiles'
import { addExistingMarkdownFileEdit } from '@/services/editor-file'
import {
  setWorkspaceSwitchHandler,
  switchWorkspaceInCurrentWindow as requestWorkspaceSwitch,
  waitForWorkspaceSwitches,
} from '@/services/workspace-switch'
import { createNewWindow, currentWindow } from '@/services/windows'
import { useEditorStore } from '@/stores'
import {
  consumeOpenedUrls,
  normalizeOpenedUrls,
  restoreOpenedUrls,
} from '@/startup/appearance'
import { createAppStartupCoordinator } from '@/startup/appStartupCoordinator'
import { createOpenedUrlQueue } from '@/startup/openedUrlQueue'
import {
  scheduleStaleStartupThemeFallback,
  STALE_STARTUP_THEME_TIMEOUT_MS,
} from '@/startup/staleThemeFallback'
import {
  loadThemeExtensionsIncrementally,
  type ThemeExtension,
} from '@/startup/themeExtensionScheduler'
import useAppSettingStore from '@/stores/useAppSettingStore'
import type { EditorLayoutNode } from '@/stores/useEditorStore'
import type { WorkspaceInfo } from '@/stores/useOpenedCacheStore'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { LazyStore } from '@tauri-apps/plugin-store'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'zens'
import __MF__ from '../context'
import useExtensionsManagerStore from '../stores/useExtensionsManagerStore'
import useThemeStore, { isBuiltInTheme } from '../stores/useThemeStore'
import useGlobalKeyboard from './useKeyboard'
import useGlobalOSInfo from './useOSInfo'
import useWorkspaceWatcher from './useWorkspaceWatcher'
import { fileTreeHandler } from '@markflowy/interface'

interface LocalTheme {
  id: string
  name: string
  path: string
  css_content: string
}

interface ThemeCatalog {
  localThemes: LocalTheme[]
  themes: ThemeExtension[]
}

interface OpenedCacheReadResult {
  recent_workspaces: WorkspaceInfo[]
}

interface CliOpenPayload {
  path: string
  kind: 'auto' | 'file' | 'workspace'
}

interface CliCommandPayload {
  id: string
}

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

interface WorkspaceCache {
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
}

type WorkspaceCachePersistence = {
  dispose: () => Promise<void>
  flush: () => Promise<void>
  getWorkspaceCache: (path: string) => Promise<WorkspaceCache | undefined>
}

const WORKSPACE_CACHE_SAVE_DEBOUNCE_MS = 800
let workspaceCachePersistence: WorkspaceCachePersistence | undefined

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
    isSameOpenedFiles(prev.openedFiles, next.openedFiles)
  )
}

const persistWorkspaceCache = async (
  cacheStore: LazyStore,
  { activeGroupId, activeId, editorLayout, openedFiles, rootPath }: WorkspaceCacheDraft,
) => {
  if (!rootPath) return

  const openedFilePaths = openedFiles
    .map((file) => file.path)
    .filter((path): path is string => Boolean(path))
  const filePathsById = new Map(openedFiles.map((file) => [file.id, file.path]))

  await cacheStore.set(rootPath, {
    version: 2,
    openedFilePaths,
    activeFilePath: activeId ? filePathsById.get(activeId) || '' : '',
    editorLayout: serializeEditorLayout(editorLayout, filePathsById),
    activeGroupId,
  })
  await cacheStore.save()
}

const createWorkspaceCachePersistence = (cacheStore: LazyStore): WorkspaceCachePersistence => {
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
    if (isSameWorkspaceCacheDraft(latestDraft, cacheDraft)) return

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
      await flush()
      try {
        await cacheStore.close()
      } catch (error) {
        logger.error('Failed to close workspace cache store', error)
      }
    },
  }
}

const setupWorkspaceCachePersistence = async (cacheStore: LazyStore) => {
  await workspaceCachePersistence?.dispose()
  workspaceCachePersistence = createWorkspaceCachePersistence(cacheStore)
  setWorkspaceSwitchHandler(performWorkspaceSwitch)
}

const disposeWorkspaceCachePersistence = async () => {
  const persistence = workspaceCachePersistence
  setWorkspaceSwitchHandler()
  workspaceCachePersistence = undefined
  await persistence?.dispose()
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

async function performWorkspaceSwitch(path: string) {
  const previousEditorState = useEditorStore.getState()
  const currentRootPath = previousEditorState.getRootPath()
  if (currentRootPath === path) return true

  const persistence = workspaceCachePersistence
  if (!persistence) {
    throw new Error('Workspace persistence is not ready')
  }

  const didSwitch = await guardUnsavedFilesAsync({
    fileIds: useEditorStore.getState().opened,
    labels: {
      save: t('action.save_and_continue'),
      unsaved: t('action.continue_without_save'),
    },
    onContinue: () =>
      savePathCoordinator.runExclusive(
        FILE_MUTATION_QUEUE_KEY,
        `workspace-switch:${path}`,
        async (lease) => {
          // Make the old workspace read-only before the first asynchronous switch step. The
          // shared mutation queue also prevents stale Explorer commits from crossing roots.
          flushSync(() => {
            lease.activate(path)
            lease.enableOtherEditorBarrier()
          })

          await persistence.flush()
          await invoke<boolean>('save_security_bookmark', { path })
          await invoke<boolean>('activate_workspace_root', { rootPath: path })

          try {
            const [workspaceCache, folderData] = await Promise.all([
              persistence.getWorkspaceCache(path),
              readDirectory(path),
            ])
            const hydratedWorkspaceCache = hydrateWorkspaceCache(workspaceCache)

            await persistence.flush()
            useEditorStore.getState().setFolderData(folderData)
            applyHydratedWorkspaceCache(hydratedWorkspaceCache)

            await useOpenedCacheStore
              .getState()
              .addRecentWorkspaces({ path })
              .catch((error) => logger.error('Failed to update recent workspaces', path, error))
            await invoke('update_window_path', {
              windowLabel: currentWindow.label,
              newPath: path,
            }).catch((error) =>
              logger.error('Failed to update window workspace path', path, error),
            )
          } catch (error) {
            if (currentRootPath) {
              await invoke<boolean>('activate_workspace_root', {
                rootPath: currentRootPath,
              }).catch((restoreError) => {
                logger.error('Failed to restore previous workspace root', restoreError)
              })
            }

            useEditorStore.getState().setFolderData(previousEditorState.folderData)
            useEditorStore
              .getState()
              .setEditorLayout(previousEditorState.editorLayout, previousEditorState.activeGroupId)
            throw error
          }
        },
      ),
  })

  if (didSwitch) appStartupCoordinator.recoverWorkspace(undefined)
  return didSwitch
}

const initThemeFromSettings = async (settingData: Record<string, any>) => {
  // Migrate the legacy field before React mounts the themed application shell.
  if (!settingData.theme_mode) {
    const oldTheme = settingData.theme || 'light'
    if (oldTheme === 'system' || oldTheme === 'light') {
      settingData.theme_mode = 'system'
    } else {
      const isDark = oldTheme.toLowerCase().includes('dark')
      settingData.theme_mode = isDark ? 'dark' : 'light'
    }
    if (!settingData.light_theme) {
      settingData.light_theme = 'MarkFlowy Light'
    }
    if (!settingData.dark_theme) {
      settingData.dark_theme = 'MarkFlowy Dark'
    }
  }

  await useThemeStore.getState().initFromSettings(settingData)
}

async function appThemeExtensionsSetup() {
  // Capture before starting the timeout or catalog I/O. If either takes over a
  // second, the synthetic theme may already have fallen back by the time the
  // catalog arrives, but its real extension must still be registered first.
  const startupTheme = useThemeStore.getState().curTheme
  const startupCustomTheme = isBuiltInTheme(startupTheme.name)
    ? undefined
    : { name: startupTheme.name, mode: startupTheme.mode }

  scheduleStaleStartupThemeFallback({
    fallback: () => useThemeStore.getState().fallbackStaleStartupTheme(),
    onFallback: (staleTheme) => {
      logger.warn(
        `Startup theme "${staleTheme.name}" did not register within ${STALE_STARTUP_THEME_TIMEOUT_MS}ms; using the built-in ${staleTheme.mode} theme.`,
      )
    },
  })

  try {
    logger.debug('Loading theme catalog...')
    const { localThemes, themes } = await invoke<ThemeCatalog>('load_theme_catalog')
    logger.debug('Local themes loaded:', localThemes.length)

    if (localThemes.length > 0) {
      const cssContents = localThemes.map((localTheme) => localTheme.css_content)
      loadLocalThemeCss(cssContents)
    }

    logger.debug('Theme catalog loaded:', themes.length)
    await loadThemeExtensionsIncrementally({
      extensions: themes,
      currentTheme: startupCustomTheme,
      loadExtension: (extension) => {
        useExtensionsManagerStore.getState().loadExtension(extension)
      },
      onError: (extension, error) => {
        logger.error(`Failed to load theme extension "${extension.id}"`, error)
      },
    })
  } catch (error) {
    logger.error('Failed to load theme catalog:', error)
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
  } finally {
    useThemeStore.getState().applyTheme()
  }
}

async function handleOpenedPaths(openedPaths: string[]) {
  const { addOpenedFile, setActiveId } = useEditorStore.getState()

  logger.debug('handleOpenedPaths', openedPaths)

  const handleOpenedPath = async (openedPath: string) => {
    const isDir = await invoke<boolean>('is_dir', { path: openedPath })

    if (isDir) {
      const rootPath = useEditorStore.getState().getRootPath()
      if (openedPath === rootPath) {
        return
      }
      if (rootPath || openedPaths.length > 1) {
        await createNewWindow({ path: openedPath })
      } else {
        await requestWorkspaceSwitch(openedPath)
      }
    } else {
      const existingFile = getFileObjectByPath(openedPath)
      if (existingFile) {
        setActiveId(existingFile.id)
        addOpenedFile(existingFile.id)
      } else {
        const fileName = getFileNameFromPath(openedPath) || 'new-file.md'
        await addExistingMarkdownFileEdit({
          fileName,
          ext: getExtFromPath(openedPath),
          path: openedPath,
        })
      }
    }
  }

  if (openedPaths.length === 1) {
    await handleOpenedPath(openedPaths[0])
  } else {
    await Promise.all(openedPaths.map(handleOpenedPath))
  }
}

const openedUrlQueue = createOpenedUrlQueue(async (openedUrls) => {
  const openedPaths = openedUrls.map((path) =>
    path.startsWith('file://') ? path.slice(7) : path,
  )
  try {
    await handleOpenedPaths(openedPaths)
    // Also consume after success in case native eval completed just after the
    // event callback claimed this batch.
    consumeOpenedUrls(openedUrls)
  } catch (error) {
    restoreOpenedUrls(openedUrls)
    throw error
  }
})

async function openWorkspaceInCurrentWindow(path: string) {
  await requestWorkspaceSwitch(path)
}

async function openFileInCurrentWindow(path: string) {
  await invoke<boolean>('save_security_bookmark', { path })
  const fileName = getFileNameFromPath(path) || 'new-file.md'
  await addExistingMarkdownFileEdit({
    fileName,
    ext: getExtFromPath(path),
    path,
  })
}

async function handleCliOpen(payload: CliOpenPayload) {
  const isWorkspace =
    payload.kind === 'workspace' ||
    (payload.kind === 'auto' && (await invoke<boolean>('is_dir', { path: payload.path })))

  if (isWorkspace) {
    await openWorkspaceInCurrentWindow(payload.path)
  } else {
    await openFileInCurrentWindow(payload.path)
  }

  currentWindow.setFocus()
}

const throwIfStartupCancelled = (signal: AbortSignal) => {
  if (!signal.aborted) return

  throw signal.reason instanceof Error ? signal.reason : new Error('Startup cancelled')
}

async function appWorkspaceSetup(signal: AbortSignal) {
  const { setRecentWorkspaces } = useOpenedCacheStore.getState()
  const { setFolderData } = useEditorStore.getState()
  logger.debug('==== appWorkspaceSetup: Checking window.openedUrls ===')
  logger.debug('window.openedUrls', window.openedUrls)

  try {
    logger.debug('Creating LazyStore for workspace cache...')
    logger.debug('Invoking get_opened_cache...')
    const [cacheStore, getOpenedCacheRes] = await Promise.all([
      new LazyStore('.markflowy_workspaces.dat', { defaults: {}, autoSave: false }),
      invoke<OpenedCacheReadResult>('get_opened_cache'),
    ])
    throwIfStartupCancelled(signal)
    logger.debug('LazyStore created successfully')
    logger.debug('get_opened_cache result:', getOpenedCacheRes)

    const recentWorkspaces = getOpenedCacheRes.recent_workspaces
    setRecentWorkspaces(recentWorkspaces)
    await setupWorkspaceCachePersistence(cacheStore)

    let handledOpenedPaths = false
    for (;;) {
      // Claim the current batch before awaiting. Native open events merge any
      // later paths into the now-empty queue, so they cannot be erased when
      // this batch completes.
      const openedUrls = consumeOpenedUrls(window.openedUrls)
      if (openedUrls.length > 0) {
        logger.debug('Processing window.openedUrls:', openedUrls)
        await openedUrlQueue.enqueue(openedUrls)
        handledOpenedPaths = true
        throwIfStartupCancelled(signal)
        continue
      }

      // A mounted runtime listener may have claimed a native-open batch while
      // the startup batch was still running. Do not publish workspace-ready
      // until that serialized work has also settled.
      await openedUrlQueue.drain()
      if (normalizeOpenedUrls(window.openedUrls).length === 0) break
    }
    if (handledOpenedPaths) {
      return
    }

    if (recentWorkspaces.length > 0) {
      logger.debug('Found recent workspaces:', recentWorkspaces)
      const targetWorkspacePath = recentWorkspaces[0].path
      logger.debug('Target workspace path:', targetWorkspacePath)

      logger.debug('Reading directory:', targetWorkspacePath)
      try {
        const [workspaceCache, res] = await Promise.all([
          cacheStore.get<WorkspaceCache>(targetWorkspacePath),
          readDirectory(targetWorkspacePath),
        ])
        throwIfStartupCancelled(signal)
        logger.debug('Cache store init result:', workspaceCache)
        const hydratedWorkspaceCache = hydrateWorkspaceCache(workspaceCache)

        logger.debug('Directory read successfully, file count:', res.length)
        setFolderData(res)
        applyHydratedWorkspaceCache(hydratedWorkspaceCache)
      } catch (error) {
        logger.error('Failed to read directory:', targetWorkspacePath, error)
        logger.error('This might be due to sandbox restrictions or the directory no longer exists')
        throw error
      }
    } else {
      logger.debug('No recent workspaces found')
    }
  } catch (error) {
    logger.error('Failed to load workspace', error)
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    throw error
  }
}

async function refreshWorkspaceFileTree() {
  const { getRootPath, setFolderDataPure } = useEditorStore.getState()
  const rootPath = getRootPath()

  if (!rootPath) {
    return
  }

  try {
    fileTreeHandler.clearLoadedDirsCache?.()
    const folderData = await readDirectory(rootPath)
    setFolderDataPure(folderData)
  } catch (error) {
    logger.error('Failed to refresh workspace after file exclude setting change', error)
  }
}

const listener = (event: MessageEvent) => {
  if (event.origin !== window.location.origin) {
    return
  }

  const { key, payload } = event.data

  switch (key) {
    case 'registerTheme':
      __MF__.theme.registerTheme(payload)
      break
  }
}

type AppShellData = Record<string, any>

const appShellSetup = async (signal: AbortSignal): Promise<AppShellData> => {
  const settingData = await appSettingStoreSetup()
  throwIfStartupCancelled(signal)

  window.removeEventListener('message', listener)
  window.addEventListener('message', listener)

  const zoomSetup = settingData.webview_zoom
    ? getCurrentWebview().setZoom(Number(settingData.webview_zoom))
    : Promise.resolve()
  await Promise.all([
    initThemeFromSettings(settingData),
    i18nInit({ lng: settingData.language }),
    zoomSetup,
  ])
  throwIfStartupCancelled(signal)

  return settingData
}

const appStartupCoordinator = createAppStartupCoordinator<AppShellData, void>({
  loadShell: appShellSetup,
  loadWorkspace: async (_shell, signal) => {
    await appWorkspaceSetup(signal)
  },
})

export const startAppSetup = () => appStartupCoordinator.start()

let deferredAppSetupPromise: Promise<void> | undefined

type DeferredSetupWindow = Window & {
  cancelIdleCallback?: (handle: number) => void
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number
}

const startDeferredAppSetup = () => {
  if (!deferredAppSetupPromise) {
    const { settingData } = useAppSettingStore.getState()
    deferredAppSetupPromise = Promise.all([
      appThemeExtensionsSetup(),
      checkUpdate({ install: settingData.auto_update }),
    ]).then(() => undefined)
  }

  return deferredAppSetupPromise
}

export const useAppRuntimeSetup = () => {
  const eventInit = useCallback(() => {
    let closeWindowPromise: Promise<boolean> | undefined
    const closeRequest = currentWindow.listen('tauri://close-requested', async () => {
      if (closeWindowPromise) {
        await closeWindowPromise
        return
      }

      const closeAttempt = waitForWorkspaceSwitches()
        .then(() =>
          guardUnsavedFilesAsync({
            fileIds: useEditorStore.getState().opened,
            onContinue: async () => {
              const rootPath = useEditorStore.getState().getRootPath()
              appStartupCoordinator.cancel()
              await disposeWorkspaceCachePersistence()
              await releaseSecurityScope(rootPath)
              const unlistenCloseRequest = await closeRequest
              unlistenCloseRequest()
              await currentWindow.destroy()
            },
          }),
        )
        .catch((error) => {
          logger.error('Failed to close window safely', error)
          toast.error(`Failed to close window: ${error}`)
          return false
        })
      closeWindowPromise = closeAttempt

      try {
        await closeAttempt
      } finally {
        if (closeWindowPromise === closeAttempt) {
          closeWindowPromise = undefined
        }
      }
    })

    const settingDataUpdate = currentWindow.listen('app_conf_change', async () => {
      const prevSettingData = useAppSettingStore.getState().settingData
      const nextSettingData = await appSettingStoreSetup()

      if (hasFileExcludePatternsChanged(prevSettingData, nextSettingData)) {
        await refreshWorkspaceFileTree()
      }
    })

    const unListenMenu = currentWindow.listen<string>('native:menu', ({ payload }) => {
      bus.emit(payload)
      commandRegistry.execute(payload)
    })

    const unListenOpenedUrls = currentWindow.listen<string[] | string>(
      'opened-urls',
      async ({ payload }) => {
        logger.debug('Received opened-urls event:', payload)
        const openedUrls = consumeOpenedUrls(payload)
        if (openedUrls.length > 0) {
          try {
            await openedUrlQueue.enqueue(openedUrls)
            currentWindow.setFocus()
          } catch (error) {
            logger.error('Failed to handle opened paths', error)
          }
        }
      },
    )

    const unListenCliOpen = currentWindow.listen<CliOpenPayload>(
      'cli:open',
      async ({ payload }) => {
        try {
          await handleCliOpen(payload)
        } catch (error) {
          logger.error('Failed to handle CLI open:', error)
          toast.error(`Failed to handle CLI open: ${error}`)
        }
      },
    )

    const unListenCliCommand = currentWindow.listen<CliCommandPayload>(
      'cli:command',
      async ({ payload }) => {
        try {
          await commandRegistry.execute(payload.id)
        } catch (error) {
          logger.error('Failed to execute CLI command:', error)
          toast.error(`Failed to execute CLI command: ${error}`)
        }
      },
    )

    return () => {
      unListenMenu.then((fn) => fn())
      closeRequest.then((fn) => fn())
      unListenOpenedUrls.then((fn) => fn())
      unListenCliOpen.then((fn) => fn())
      unListenCliCommand.then((fn) => fn())
      settingDataUpdate.then((fn) => fn())
    }
  }, [])

  // native event listener
  useEffect(() => {
    const unlisten = eventInit()

    return () => {
      unlisten()
    }
  }, [eventInit])

  useEffect(() => {
    const targetWindow = window as DeferredSetupWindow
    let secondFrameId: number | undefined
    let idleCallbackId: number | undefined
    let fallbackTimeoutId: number | undefined
    const startDeferredWork = () => {
      try {
        performance.mark('mf:startup:deferred-start')
      } catch {
        // Startup diagnostics must never become a startup dependency.
      }
      void startDeferredAppSetup()
    }
    const firstFrameId = targetWindow.requestAnimationFrame(() => {
      secondFrameId = targetWindow.requestAnimationFrame(() => {
        if (typeof targetWindow.requestIdleCallback === 'function') {
          idleCallbackId = targetWindow.requestIdleCallback(startDeferredWork, { timeout: 500 })
          return
        }

        fallbackTimeoutId = targetWindow.setTimeout(startDeferredWork, 120)
      })
    })

    return () => {
      targetWindow.cancelAnimationFrame(firstFrameId)
      if (secondFrameId !== undefined) targetWindow.cancelAnimationFrame(secondFrameId)
      if (idleCallbackId !== undefined) targetWindow.cancelIdleCallback?.(idleCallbackId)
      if (fallbackTimeoutId !== undefined) targetWindow.clearTimeout(fallbackTimeoutId)
    }
  }, [])

  useEffect(() => {
    const updateWindowState = (workspacePath?: string) => {
      invoke('update_cli_window_state', {
        windowId: currentWindow.label,
        workspacePath: workspacePath || '',
      }).catch((error) => {
        logger.error('Failed to update CLI window state:', error)
      })
    }

    updateWindowState(useEditorStore.getState().getRootPath())
    const unsubscribe = useEditorStore.subscribe(
      (state) => state.getRootPath(),
      (rootPath) => {
        updateWindowState(rootPath)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const disposable = commandRegistry.onDidChangeCommands((commands) => {
      invoke('update_cli_command_state', {
        commands: commands.map((command) => ({
          id: command.id,
          label: command.label,
          category: command.category,
        })),
      }).catch((error) => {
        logger.error('Failed to update CLI command state:', error)
      })
    })

    return () => {
      disposable.dispose()
    }
  }, [])

  useGlobalOSInfo()
  useGlobalKeyboard()
  useWorkspaceWatcher()
}

const useAppSetup = () => {
  const snapshot = useSyncExternalStore(
    appStartupCoordinator.subscribe,
    appStartupCoordinator.getSnapshot,
    appStartupCoordinator.getSnapshot,
  )

  useEffect(() => {
    void startAppSetup()
  }, [])

  return {
    ...snapshot,
    cancel: appStartupCoordinator.cancel,
    retry: appStartupCoordinator.retry,
  }
}

export default useAppSetup
