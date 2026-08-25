import bus from '@/helper/eventBus'
import {
  getFileIdsByPathIdentity,
  getFileObject,
  updateFileObject,
} from '@/helper/files'
import { logger } from '@/helper/logger'
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

export const EXTERNAL_FILE_CONTENT_SYNC_EVENT = 'external_file_content_sync'
export const EXTERNAL_FILE_NOTICE_DURATION_MS = 3000

export interface ExternalFileContentSyncPayload {
  content: string
  fileId: string
}

const observationTails = new Map<string, Promise<void>>()
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

async function inspectExternalPath(fileId: string, filePath: string, generation: number) {
  await fileSaveCoordinator.waitForIdle(fileId)
  if (generation !== workspaceGeneration) return

  const snapshot = await readStableFileSnapshot(filePath)
  if (snapshot.status !== 'success') return
  if (generation !== workspaceGeneration || !useEditorStore.getState().opened.includes(fileId)) {
    return
  }

  const knownDiskRevision = fileSaveCoordinator.getDiskRevision(fileId)
  if (knownDiskRevision === snapshot.revision) return

  const editorStore = useEditorStore.getState()
  const localContent = editorStore.getEditorContent(fileId)
  const isDirty =
    useEditorStateStore.getState().idStateMap.get(fileId)?.hasUnsavedChanges ?? false

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

  applyExternalSnapshot(fileId, snapshot, 'reloaded')
}

function enqueueExternalInspection(fileId: string, filePath: string, generation: number) {
  const previous = observationTails.get(fileId) ?? Promise.resolve()
  const next = previous
    .then(() => inspectExternalPath(fileId, filePath, generation))
    .catch((error) => logger.error('Failed to inspect an external file change', error))

  observationTails.set(fileId, next)
  void next.finally(() => {
    if (observationTails.get(fileId) === next) observationTails.delete(fileId)
  })
  return next
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
      applyExternalSnapshot(fileId, diskSnapshot, 'reloaded')
      return
    }

    const localContent = useEditorStore.getState().getEditorContent(fileId)
    fileSaveCoordinator.recordContent(fileId, localContent)
    const result = await conditionalWriteExpected(
      file.path,
      localContent,
      diskSnapshot.revision,
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
