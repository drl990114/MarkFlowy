import bus from '@/helper/eventBus'
import { getFileIdsByPathIdentity, getFileObject, updateFileObject } from '@/helper/files'
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
import { fileSaveCoordinator } from './fileSaveCoordinator'
import { readStableFileSnapshot, type StableFileSnapshot } from './fileSnapshot'
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

function applyExternalSnapshot(
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

  fileSaveCoordinator.recordContent(fileId, snapshot.content)
  fileSaveCoordinator.setDiskRevision(fileId, snapshot.revision)
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
) {
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

  if (localContent === snapshot.content) {
    const file = getFileObject(fileId)
    if (file) {
      updateFileObject(fileId, {
        ...file,
        content: snapshot.content,
      })
    }
    fileSaveCoordinator.recordContent(fileId, snapshot.content)
    fileSaveCoordinator.setDiskRevision(fileId, snapshot.revision)
    useEditorStateStore.getState().setIdStateMap(fileId, {
      hasUnsavedChanges: false,
    })
    useExternalFileChangeStore.getState().clear(fileId)
    return
  }

  if (isDirty) {
    await protectExternalContent(fileId, localContent, snapshot.content)
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

  await protectExternalContent(fileId, localContent, snapshot.content)
  if (
    generation !== workspaceGeneration ||
    !useEditorStore.getState().opened.includes(fileId) ||
    useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges ||
    useEditorStore.getState().getEditorContent(fileId) !== localContent
  ) {
    markExternalFileConflict(fileId, snapshot.revision)
    return
  }
  applyExternalSnapshot(fileId, snapshot, 'reloaded')
}

function enqueueExternalInspection(fileId: string, filePath: string, generation: number) {
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
              await inspectExternalPath(id, generation, snapshot)
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
  const openedIds = new Set(useEditorStore.getState().opened)
  const inspections = new Map<string, Promise<void>>()

  for (const filePath of event.paths) {
    for (const fileId of getFileIdsByPathIdentity(filePath)) {
      if (!openedIds.has(fileId) || inspections.has(fileId)) continue
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
      await protectExternalContent(fileId, before, diskSnapshot.content)
      if (useEditorStore.getState().getEditorContent(fileId) !== before) {
        markResolutionFailed(fileId, diskSnapshot.revision)
        return
      }
      applyExternalSnapshot(fileId, diskSnapshot, 'reloaded')
      historyFileSaved(fileId)
      return
    }

    const localContent = useEditorStore.getState().getEditorContent(fileId)
    fileSaveCoordinator.recordContent(fileId, localContent)
    const result = await conditionalWriteExpected(
      file.path,
      localContent,
      diskSnapshot.revision,
      undefined,
      'overwrite',
    )
    if (result.status === 'conflict') {
      markExternalFileConflict(fileId, result.revision)
      return
    }

    applyExternalSnapshot(
      fileId,
      {
        content: localContent,
        revision: result.revision,
        status: 'success',
      },
      'overwritten',
    )
    historyFileSaved(fileId)
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
