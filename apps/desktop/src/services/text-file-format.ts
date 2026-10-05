import { getFileObject, getSaveOpenedEditorEntries } from '@/helper/files'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { editorSnapshotRegistry } from '@/components/EditorArea/editorSnapshotRegistry'
import { applyExternalSnapshot } from '@/components/EditorArea/externalFileChanges'
import {
  readStableFileSnapshot,
  type StableFileSnapshot,
} from '@/components/EditorArea/fileSnapshot'
import { getFileWriteRevision } from '@/components/EditorArea/conditionalFileWrite'
import type { TextEncoding, TextFileFormat } from '@/components/EditorArea/textFileFormat'
import {
  historyCall,
  historyDocument,
  historyDraftIdentity,
  historyFileSaved,
  protectLocalEdit,
  flushDraftProtection,
} from './local-history'

export interface EncodingPreview {
  fileId: string
  path: string
  revision: number
  previousContent: string
  snapshot: StableFileSnapshot
}

export async function previewFileEncoding(
  fileId: string,
  encoding: TextEncoding,
): Promise<EncodingPreview> {
  await fileSaveCoordinator.waitForIdle(fileId)
  if (!editorSnapshotRegistry.flush(fileId)) throw new Error('请等待当前输入完成。')
  const path = getFileObject(fileId)?.path
  if (!path) throw new Error('请先保存文件。')
  const previousContent = useEditorStore.getState().getEditorContent(fileId)
  const revision = fileSaveCoordinator.getRevision(fileId)
  const snapshot = await readStableFileSnapshot(path, { encoding })
  if (snapshot.status !== 'success')
    throw new Error(
      snapshot.status === 'unavailable' ? snapshot.result.content : '文件正在变化，请重试。',
    )
  return { fileId, path, revision, previousContent, snapshot }
}

export async function applyEncodingPreview(preview: EncodingPreview): Promise<void> {
  const { fileId, path, revision, previousContent, snapshot } = preview
  return fileSaveCoordinator.runExclusive(fileId, async () => {
    const valid = () =>
      getFileObject(fileId)?.path === path &&
      useEditorStore.getState().opened.includes(fileId) &&
      editorSnapshotRegistry.canRead(fileId) &&
      !editorSnapshotRegistry.hasPending(fileId) &&
      fileSaveCoordinator.getRevision(fileId) === revision &&
      useEditorStore.getState().getEditorContent(fileId) === previousContent
    if (!valid()) throw new Error('文档已变化，请重新预览。')
    // Use an independent writer so finishing the new document never retires the displaced draft.
    const format = fileSaveCoordinator.getPersistedFormat(fileId)
    const previousDiskRevision = fileSaveCoordinator.getDiskRevision(fileId)
    const identity = historyDraftIdentity(fileId)
    const document = await historyDocument(fileId)
    const protectedDraft = await historyCall<{ persisted: boolean }>('draft', {
      document,
      ...identity,
      writer: `before-encoding:${identity.writer}:${identity.sequence}`,
      content: previousContent,
      paused: true,
      diskRevision: previousDiskRevision,
      format,
    })
    if (!protectedDraft.persisted) throw new Error('当前内容尚未完成草稿保护，请重试。')
    const diskRevision = await getFileWriteRevision(path)
    if (!valid() || diskRevision !== snapshot.revision)
      throw new Error('文档或磁盘文件已变化，请重新预览。')
    applyExternalSnapshot(fileId, snapshot, 'reloaded')
    historyFileSaved(fileId)
  })
}

export async function saveFileWithFormat(fileId: string, format: TextFileFormat): Promise<boolean> {
  if (!useEditorStore.getState().opened.includes(fileId) || !editorSnapshotRegistry.flush(fileId))
    return false
  fileSaveCoordinator.recordFormat(fileId, format)
  useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: true })
  protectLocalEdit(fileId)
  await flushDraftProtection(fileId)
  return (await getSaveOpenedEditorEntries(fileId)?.()) ?? false
}
