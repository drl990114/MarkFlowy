import { flushSync } from 'react-dom'
import bus from '@/helper/eventBus'
import { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile, updateFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import {
  savePathCoordinator,
  FILE_MUTATION_QUEUE_KEY,
} from '@/components/EditorArea/savePathCoordinator'
import {
  EXTERNAL_FILE_CONTENT_SYNC_EVENT,
  markExternalFileConflict,
} from '@/components/EditorArea/externalFileChanges'
import {
  readStableFileSnapshot,
  type StableFileSnapshot,
} from '@/components/EditorArea/fileSnapshot'
import {
  bindRecoveredDraft,
  flushDraftProtection,
  historyCall,
  historyDocument,
  historyDraftIdentity,
  pauseHistoryAutosave,
  historyChanged,
  type HistoryDocument,
} from './local-history'

function updateRestoredBaseline(
  fileId: string,
  disk: StableFileSnapshot,
  content: string | undefined,
) {
  fileSaveCoordinator.setSavedBaseline(fileId, disk)
  const previousRevision = fileSaveCoordinator.getDiskRevision(fileId)
  if (previousRevision && previousRevision !== disk.revision && content !== disk.content)
    markExternalFileConflict(fileId, disk.revision)
  else fileSaveCoordinator.setDiskRevision(fileId, disk.revision)
}

function createRestoredFile(document: HistoryDocument, content: string, diskAvailable: boolean) {
  return createFile({
    name: document.name,
    content: content,
    path: diskAvailable ? (document.path ?? undefined) : undefined,
    ext: document.name.match(/\.([^./\\]+)$/)?.[1].toLowerCase() ?? 'md',
  })
}

function publishRestoredDraft(
  fileId: string,
  content: string,
  format: Parameters<typeof fileSaveCoordinator.recordFormat>[1] | undefined,
  disk: Awaited<ReturnType<typeof readStableFileSnapshot>> | undefined,
  previousContent: string | undefined,
) {
  updateFile({ id: fileId, content: content })
  fileSaveCoordinator.recordContent(fileId, content)
  fileSaveCoordinator.recordFormat(
    fileId,
    format ?? fileSaveCoordinator.getTextMetadata(fileId).format,
    !!format,
  )
  if (disk?.status === 'success') updateRestoredBaseline(fileId, disk, previousContent)
  pauseHistoryAutosave(fileId, true)
  useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: true })
  if (!useEditorStore.getState().opened.includes(fileId))
    useEditorStore.getState().addOpenedFile(fileId)
  useEditorStore.getState().setActiveId(fileId)
  bus.emit(EXTERNAL_FILE_CONTENT_SYNC_EVENT, undefined, {
    fileId: fileId,
    content: content,
  })
}

function readOpenedContent(file: ReturnType<typeof getFileObject> | undefined) {
  return file && useEditorStore.getState().opened.includes(file.id)
    ? useEditorStore.getState().getEditorContent(file.id)
    : undefined
}

function assertRestoreTargetCurrent(
  file: ReturnType<typeof getFileObject> | undefined,
  content: string | undefined,
) {
  if (
    file &&
    getFileObject(file.id) !== file &&
    useEditorStore.getState().getEditorContent(file.id) !== content
  )
    throw new Error('content_changed')
}

export async function restoreHistory(entryId: string, before = false) {
  return savePathCoordinator.runExclusive(
    FILE_MUTATION_QUEUE_KEY,
    'history-restore',
    async (lease) => {
      const snapshot = await historyCall<{ document: HistoryDocument; content: string }>('read', {
        entryId,
        before,
      })
      let file = snapshot.document.path ? getFileObjectByPath(snapshot.document.path) : undefined
      const content = readOpenedContent(file)
      flushSync(() => {
        lease.activate('history-restore')
        lease.enableOtherEditorBarrier()
      })
      const disk = snapshot.document.path
        ? await readStableFileSnapshot(snapshot.document.path)
        : undefined
      assertRestoreTargetCurrent(file, content)
      // A second read validates that deletion has not invalidated the selected version.
      await historyCall('read', { entryId, before })
      if (content === undefined && disk?.status !== 'success') file = undefined
      if (!file)
        file = createRestoredFile(snapshot.document, snapshot.content, disk?.status === 'success')
      const document = await historyDocument(file.id)
      const oldContent = content ?? file.content ?? ''
      // Persist the new draft before replacing the live document.
      const draft = {
        document,
        ...historyDraftIdentity(file.id),
        content: snapshot.content,
        diskRevision: disk?.status === 'success' ? disk.revision : undefined,
        paused: true,
        format: fileSaveCoordinator.getTextMetadata(file.id).format,
      }
      const protectedDraft = await historyCall<typeof draft>('restore', {
        entryId,
        before,
        draft,
        previous: content ?? (disk?.status === 'success' ? disk.content : ''),
      })
      await bindRecoveredDraft(file.id, protectedDraft)
      if (
        content !== undefined &&
        useEditorStore.getState().getEditorContent(file.id) !== oldContent
      )
        throw new Error('content_changed')
      publishRestoredDraft(file.id, snapshot.content, protectedDraft.format, disk, content)
      await flushDraftProtection(file.id)
      historyChanged()
    },
  )
}
