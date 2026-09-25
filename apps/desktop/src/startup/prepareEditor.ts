import { preloadCapricornRuntimeFactory } from '@/components/EditorArea/capricornRuntimeAdapter'
import { loadEditorAreaContent } from '@/components/EditorArea/editorAreaLoader'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { editorSnapshotRegistry } from '@/components/EditorArea/editorSnapshotRegistry'
import {
  onFileSnapshotInvalidated,
  readStableFileSnapshot,
  type FileSnapshotResult,
} from '@/components/EditorArea/fileSnapshot'
import { isCapricornView } from '@/constants/editorViewType'
import { getFileObject } from '@/helper/files'
import { getFileTypeConfig, isSupportedMode, isTextfileType } from '@/helper/fileTypeHandler'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import { isDraftRecoveryPending } from '@/services/draftRecoveryState'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorStore from '@/stores/useEditorStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { startupInteractive } from './interactive'
import { markStartupStage } from './performance'

interface StartupRead {
  fileId: string
  path: string
  promise: Promise<FileSnapshotResult>
  isCurrent: () => boolean
  dispose: () => void
}
let preparedRead: StartupRead | undefined

/** Module I/O is safe before recovery; document bytes wait for draft selection. */
export async function prepareStartupEditorModules(signal: AbortSignal) {
  const { activeId, folderData } = useEditorStore.getState()
  const file = activeId ? getFileObject(activeId) : undefined
  if (!file || signal.aborted) return
  void loadEditorAreaContent().catch(() => undefined)
  const config = await getFileTypeConfig(file)
  if (signal.aborted || useEditorStore.getState().activeId !== activeId ||
    useEditorStore.getState().folderData?.[0] !== folderData?.[0]) return
  const existing = useEditorViewTypeStore.getState().editorViewTypeMap.get(file.id)
  const mode = existing && isSupportedMode(config, existing) ? existing : config.defaultMode
  if (config.type === 'markdown' && isCapricornView(mode)) void preloadCapricornRuntimeFactory()
}

/** A single startup request owns these bytes; this never becomes a general disk cache. */
export async function prepareStartupDocumentRead(signal: AbortSignal) {
  preparedRead?.dispose()
  preparedRead = undefined
  const { activeId, folderData } = useEditorStore.getState()
  const file = activeId ? getFileObject(activeId) : undefined
  if (!file?.path || signal.aborted || isDraftRecoveryPending(file.id)) return
  if (useEditorStateStore.getState().idStateMap.get(file.id)?.hasUnsavedChanges) return
  if (editorSnapshotRegistry.hasPending(file.id) || !editorSnapshotRegistry.canRead(file.id)) return
  const config = await getFileTypeConfig(file)
  if (!isTextfileType(config) || signal.aborted) return
  const root = folderData?.[0]
  const revision = fileSaveCoordinator.getRevision(file.id)
  const diskRevision = fileSaveCoordinator.getDiskRevision(file.id)
  const path = getPathIdentityKey(file.path)
  let invalidated = false
  const unsubscribe = onFileSnapshotInvalidated((changedPath) => {
    if (path === changedPath) invalidated = true
  })
  const isCurrent = () =>
    !invalidated && !signal.aborted &&
    useEditorStore.getState().activeId === file.id &&
    useEditorStore.getState().folderData?.[0] === root &&
    getFileObject(file.id)?.path === file.path &&
    getFileObject(file.id)?.content === file.content &&
    fileSaveCoordinator.getRevision(file.id) === revision &&
    fileSaveCoordinator.getDiskRevision(file.id) === diskRevision &&
    !editorSnapshotRegistry.hasPending(file.id) && editorSnapshotRegistry.canRead(file.id) &&
    !isDraftRecoveryPending(file.id) &&
    !useEditorStateStore.getState().idStateMap.get(file.id)?.hasUnsavedChanges
  if (!isCurrent()) { unsubscribe(); return }
  const cleanup: { stopInteractive?: () => void } = {}
  const dispose = () => {
    invalidated = true
    unsubscribe()
    cleanup.stopInteractive?.()
    signal.removeEventListener('abort', dispose)
    if (preparedRead?.dispose === dispose) preparedRead = undefined
  }
  markStartupStage('active-read-start')
  const promise = readStableFileSnapshot(file.path, {
    reuseInFlight: true, scope: root, priority: 'foreground', signal,
  }).then((snapshot) => {
    markStartupStage('active-read-ready')
    return snapshot
  })
  void promise.catch(() => undefined)
  preparedRead = { fileId: file.id, path, promise, isCurrent, dispose }
  signal.addEventListener('abort', dispose, { once: true })
  cleanup.stopInteractive = startupInteractive.subscribe(dispose)
}

export function takeStartupDocumentRead(fileId: string, path: string) {
  const read = preparedRead
  if (!read || read.fileId !== fileId || read.path !== getPathIdentityKey(path)) return undefined
  preparedRead = undefined
  return read.promise.then((snapshot) => read.isCurrent() ? snapshot : undefined).finally(read.dispose)
}
