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
import { readStableFileSnapshot } from '@/components/EditorArea/fileSnapshot'
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
      const content =
        file && useEditorStore.getState().opened.includes(file.id)
          ? useEditorStore.getState().getEditorContent(file.id)
          : undefined
      flushSync(() => {
        lease.activate('history-restore')
        lease.enableOtherEditorBarrier()
      })
      const disk = snapshot.document.path
        ? await readStableFileSnapshot(snapshot.document.path)
        : undefined
      if (
        file &&
        getFileObject(file.id) !== file &&
        useEditorStore.getState().getEditorContent(file.id) !== content
      )
        throw new Error('content_changed')
      // A second read validates that deletion has not invalidated the selected version.
      await historyCall('read', { entryId, before })
      if (content === undefined && disk?.status !== 'success') file = undefined
      if (!file)
        file = createFile({
          name: snapshot.document.name,
          content: snapshot.content,
          path: disk?.status === 'success' ? (snapshot.document.path ?? undefined) : undefined,
          ext: snapshot.document.name.match(/\.([^./\\]+)$/)?.[1].toLowerCase() ?? 'md',
        })
      const document = await historyDocument(file.id)
      const oldContent = content ?? file.content ?? ''
      // Persist the new draft before replacing the live document.
      const draft = {
        document,
        ...historyDraftIdentity(file.id),
        content: snapshot.content,
        diskRevision: disk?.status === 'success' ? disk.revision : undefined,
        paused: true,
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
      updateFile({ id: file.id, content: snapshot.content })
      fileSaveCoordinator.recordContent(file.id, snapshot.content)
      if (disk?.status === 'success') {
        const previousRevision = fileSaveCoordinator.getDiskRevision(file.id)
        if (previousRevision && previousRevision !== disk.revision && content !== disk.content)
          markExternalFileConflict(file.id, disk.revision)
        else fileSaveCoordinator.setDiskRevision(file.id, disk.revision)
      }
      pauseHistoryAutosave(file.id, true)
      useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: true })
      if (!useEditorStore.getState().opened.includes(file.id))
        useEditorStore.getState().addOpenedFile(file.id)
      useEditorStore.getState().setActiveId(file.id)
      bus.emit(EXTERNAL_FILE_CONTENT_SYNC_EVENT, undefined, {
        fileId: file.id,
        content: snapshot.content,
      })
      await flushDraftProtection(file.id)
      historyChanged()
    },
  )
}
