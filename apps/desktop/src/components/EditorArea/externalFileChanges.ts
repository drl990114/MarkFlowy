import bus from '@/helper/eventBus'
import { getFileObject, updateFileObject } from '@/helper/files'
import { logger } from '@/helper/logger'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import { t } from '@/i18n'
import { useEditorStateStore, useEditorStore } from '@/stores'
import useExternalFileChangeStore, {
  type ExternalFileChangeAction,
  type ExternalFileChangeStatus,
} from '@/stores/useExternalFileChangeStore'
import type { WatchEvent } from '@tauri-apps/plugin-fs'
import { toast } from 'zens'
import { conditionalWriteExpected } from './conditionalFileWrite'
import { editorSnapshotRegistry } from './editorSnapshotRegistry'
import { fileSaveCoordinator } from './fileSaveCoordinator'
import { invalidateFileSnapshotHandoffs, readStableFileSnapshot, type StableFileSnapshot } from './fileSnapshot'
import { sameTextFormat } from './textFileFormat'
import { historyFileSaved, protectExternalContent } from '@/services/local-history'

export const EXTERNAL_FILE_CONTENT_SYNC_EVENT = 'external_file_content_sync'
export const EXTERNAL_FILE_NOTICE_DURATION_MS = 3000

export interface ExternalFileContentSyncPayload {
  content: string
  fileId: string
}

const observationTails = new Map<
  string,
  { pending: boolean; fileIds: Set<string>; promise: Promise<void> }
>()
const noticeTimers = new Map<string, ReturnType<typeof setTimeout>>()
let noticeToken = 0
let workspaceGeneration = 0

function clearNoticeTimer(fileId: string) {
  const timer = noticeTimers.get(fileId)
  if (timer) clearTimeout(timer)
  noticeTimers.delete(fileId)
}

function showTransientNotice(fileId: string, status: ExternalFileChangeStatus) {
  clearNoticeTimer(fileId)
  const token = ++noticeToken
  useExternalFileChangeStore.getState().setNotice(fileId, {
    kind: 'updated',
    status,
    token,
  })
  noticeTimers.set(
    fileId,
    setTimeout(() => {
      const notice = useExternalFileChangeStore.getState().notices[fileId]
      if (notice?.kind === 'updated' && notice.token === token) {
        useExternalFileChangeStore.getState().clear(fileId)
      }
      noticeTimers.delete(fileId)
    }, EXTERNAL_FILE_NOTICE_DURATION_MS),
  )
}

export function markExternalFileConflict(fileId: string, diskRevision: string) {
  clearNoticeTimer(fileId)
  useExternalFileChangeStore.getState().setNotice(fileId, {
    diskRevision,
    kind: 'conflict',
  })
}

function markResolutionFailed(fileId: string, fallbackRevision: string) {
  const notice = useExternalFileChangeStore.getState().notices[fileId]
  markExternalFileConflict(
    fileId,
    notice?.kind === 'conflict' ? notice.diskRevision : fallbackRevision,
  )
}

export function applyExternalSnapshot(
  fileId: string,
  snapshot: StableFileSnapshot,
  status: ExternalFileChangeStatus,
) {
  const file = getFileObject(fileId)
  if (file) {
    updateFileObject(fileId, {
      ...file,
      content: snapshot.content,
    })
  }

  fileSaveCoordinator.loadSnapshot(fileId, snapshot)
  useEditorStateStore.getState().setIdStateMap(fileId, {
    hasUnsavedChanges: false,
  })
  bus.emit(EXTERNAL_FILE_CONTENT_SYNC_EVENT, undefined, {
    content: snapshot.content,
    fileId,
  } satisfies ExternalFileContentSyncPayload)
  showTransientNotice(fileId, status)
}

async function inspectExternalPath(
  fileId: string,
  generation: number,
  snapshot: StableFileSnapshot,
  observedPath: string,
) {
  if (getPathIdentityKey(getFileObject(fileId)?.path ?? '') !== getPathIdentityKey(observedPath))
    return
  if (generation !== workspaceGeneration || !useEditorStore.getState().opened.includes(fileId)) {
    return
  }

  const knownDiskRevision = fileSaveCoordinator.getDiskRevision(fileId)
  if (knownDiskRevision === snapshot.revision) return

  const editorStore = useEditorStore.getState()
  let localContent: string
  try {
    localContent = editorStore.getEditorContent(fileId)
  } catch (error) {
    // A composing or failed live reader must not be treated as the cached
    // version on disk. Keep local edits protected until comparison can retry.
    logger.error('Failed to read local content for an external file change', error)
    markExternalFileConflict(fileId, snapshot.revision)
    return
  }
  const isDirty = useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges ?? false

  const localRevision = fileSaveCoordinator.getRevision(fileId)
  const afterFormat = snapshot.text?.decoding.needsConfirmation ? undefined : snapshot.text?.format
  if (
    localContent === snapshot.content &&
    (!isDirty ||
      (!fileSaveCoordinator.hasFormatChanges(fileId) &&
        sameTextFormat(
          fileSaveCoordinator.getTextMetadata(fileId).format,
          snapshot.text?.format ?? fileSaveCoordinator.getTextMetadata(fileId).format,
        )))
  ) {
    await protectExternalContent(fileId, localContent, snapshot.content, afterFormat)
    if (
      generation !== workspaceGeneration ||
      !useEditorStore.getState().opened.includes(fileId) ||
      getPathIdentityKey(getFileObject(fileId)?.path ?? '') !== getPathIdentityKey(observedPath) ||
      fileSaveCoordinator.getRevision(fileId) !== localRevision ||
      !editorSnapshotRegistry.canRead(fileId) ||
      editorSnapshotRegistry.hasPending(fileId) ||
      useEditorStore.getState().getEditorContent(fileId) !== localContent
    ) {
      markExternalFileConflict(fileId, snapshot.revision)
      return
    }
    const file = getFileObject(fileId)
    if (file) {
      updateFileObject(fileId, {
        ...file,
        content: snapshot.content,
      })
    }
    fileSaveCoordinator.loadSnapshot(fileId, snapshot)
    useEditorStateStore.getState().setIdStateMap(fileId, {
      hasUnsavedChanges: false,
    })
    useExternalFileChangeStore.getState().clear(fileId)
    return
  }

  if (isDirty) {
    await protectExternalContent(fileId, localContent, snapshot.content, afterFormat)
    markExternalFileConflict(fileId, snapshot.revision)
    return
  }

  const latestContent = useEditorStore.getState().getEditorContent(fileId)
  const becameDirty =
    useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges ?? false
  if (becameDirty || latestContent !== localContent) {
    markExternalFileConflict(fileId, snapshot.revision)
    return
  }

  await protectExternalContent(fileId, localContent, snapshot.content, afterFormat)
  if (
    generation !== workspaceGeneration ||
    !useEditorStore.getState().opened.includes(fileId) ||
    getPathIdentityKey(getFileObject(fileId)?.path ?? '') !== getPathIdentityKey(observedPath) ||
    useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges ||
    useEditorStore.getState().getEditorContent(fileId) !== localContent
  ) {
    markExternalFileConflict(fileId, snapshot.revision)
    return
  }
  applyExternalSnapshot(fileId, snapshot, 'reloaded')
}

function enqueueExternalInspection(fileId: string, filePath: string, generation: number) {
  invalidateFileSnapshotHandoffs(filePath)
  const key = getPathIdentityKey(filePath)
  const previous = observationTails.get(key)
  if (previous) {
    previous.pending = true
    previous.fileIds.add(fileId)
    return previous.promise
  }
  const state = { pending: true, fileIds: new Set([fileId]), promise: Promise.resolve() }
  state.promise = Promise.resolve()
    .then(async () => {
      let retries = 0
      while (state.pending && generation === workspaceGeneration) {
        state.pending = false
        await Promise.all([...state.fileIds].map((id) => fileSaveCoordinator.waitForIdle(id)))
        if (generation !== workspaceGeneration) return
        const snapshot = await readStableFileSnapshot(filePath)
        if (snapshot.status !== 'success') {
          state.pending ||= retries++ < 2
        } else {
          for (const id of state.fileIds) {
            try {
              await inspectExternalPath(id, generation, snapshot, filePath)
            } catch (error) {
              if (generation !== workspaceGeneration) return
              markExternalFileConflict(id, snapshot.revision)
              logger.error('Failed to protect an external file change', error)
              if (/content_changed|file_unstable/.test(String(error)))
                state.pending ||= retries++ < 2
            }
          }
        }
        if (state.pending) await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    })
    .catch((error) => logger.error('Failed to inspect an external file change', error))
    .finally(() => {
      if (observationTails.get(key) === state) observationTails.delete(key)
    })
  observationTails.set(key, state)
  return state.promise
}

export async function handleExternalWatchEvent(event: WatchEvent): Promise<void> {
  const generation = workspaceGeneration
  // Index only live documents once per event batch. Directory caches can hold
  // tens of thousands of entries; unrelated changes must never scan them.
  const openedByPath = new Map<string, string[]>()
  for (const fileId of useEditorStore.getState().opened) {
    const path = getFileObject(fileId)?.path
    if (!path) continue
    const key = getPathIdentityKey(path)
    const ids = openedByPath.get(key)
    if (ids) ids.push(fileId)
    else openedByPath.set(key, [fileId])
  }
  const inspections = new Map<string, Promise<void>>()

  for (const filePath of event.paths) {
    for (const fileId of openedByPath.get(getPathIdentityKey(filePath)) ?? []) {
      if (inspections.has(fileId)) continue
      inspections.set(fileId, enqueueExternalInspection(fileId, filePath, generation))
    }
  }

  await Promise.all(inspections.values())
}

export async function resolveExternalFileChange(
  fileId: string,
  action: ExternalFileChangeAction,
): Promise<void> {
  const notice = useExternalFileChangeStore.getState().notices[fileId]
  const file = getFileObject(fileId)
  if (notice?.kind !== 'conflict' || !file?.path || notice.resolving) return

  useExternalFileChangeStore.getState().setNotice(fileId, {
    ...notice,
    resolving: action,
  })

  try {
    await fileSaveCoordinator.waitForIdle(fileId)
    const diskSnapshot = await readStableFileSnapshot(file.path)
    if (diskSnapshot.status !== 'success') {
      markResolutionFailed(fileId, notice.diskRevision)
      toast.error(t('external_file_change.read_failed'))
      return
    }

    if (action === 'reload') {
      const before = useEditorStore.getState().getEditorContent(fileId)
      const revision = fileSaveCoordinator.getRevision(fileId)
      const afterFormat = diskSnapshot.text?.decoding.needsConfirmation
        ? undefined
        : diskSnapshot.text?.format
      await protectExternalContent(fileId, before, diskSnapshot.content, afterFormat)
      if (
        useEditorStore.getState().getEditorContent(fileId) !== before ||
        fileSaveCoordinator.getRevision(fileId) !== revision ||
        getFileObject(fileId)?.path !== file.path
      ) {
        markResolutionFailed(fileId, diskSnapshot.revision)
        return
      }
      applyExternalSnapshot(fileId, diskSnapshot, 'reloaded')
      historyFileSaved(fileId)
      return
    }

    fileSaveCoordinator.recordContent(fileId, useEditorStore.getState().getEditorContent(fileId))
    let expectedRevision = diskSnapshot.revision
    let originalFormat = diskSnapshot.text?.format
    const saved = await fileSaveCoordinator.saveLatest(
      fileId,
      async (snapshot) => {
        if (typeof snapshot.content !== 'string' || getFileObject(fileId)?.path !== file.path)
          return false
        const result = await conditionalWriteExpected(
          file.path!,
          snapshot.content,
          expectedRevision,
          undefined,
          'overwrite',
          { ...snapshot.textOptions, originalFormat },
        )
        if (result.status === 'conflict') {
          markExternalFileConflict(fileId, result.revision)
          return false
        }
        expectedRevision = result.revision
        originalFormat = snapshot.textOptions.format
        fileSaveCoordinator.acknowledgeSaved(fileId, snapshot, result.revision)
        return true
      },
      (snapshot) => {
        applyExternalSnapshot(
          fileId,
          {
            content: snapshot.content!,
            revision: expectedRevision,
            status: 'success',
            text: fileSaveCoordinator.getTextMetadata(fileId),
          },
          'overwritten',
        )
        historyFileSaved(fileId)
      },
      {
        canAttempt: () =>
          getFileObject(fileId)?.path === file.path &&
          useEditorStore.getState().opened.includes(fileId) &&
          editorSnapshotRegistry.canRead(fileId) &&
          !editorSnapshotRegistry.hasPending(fileId),
      },
    )
    if (!saved) markResolutionFailed(fileId, expectedRevision)
  } catch (error) {
    logger.error('Failed to resolve an external file change', error)
    markResolutionFailed(fileId, notice.diskRevision)
    toast.error(t('external_file_change.resolve_failed'))
  }
}

export function releaseExternalFileChange(fileId: string) {
  clearNoticeTimer(fileId)
  useExternalFileChangeStore.getState().clear(fileId)
}

export function resetExternalFileChanges() {
  workspaceGeneration += 1
  observationTails.clear()
  noticeTimers.forEach((timer) => clearTimeout(timer))
  noticeTimers.clear()
  useExternalFileChangeStore.getState().clearAll()
}
