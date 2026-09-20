import { enableMapSet } from 'immer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { createFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { restoreHistory } from './restore-history'

const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  pause: vi.fn(),
  bind: vi.fn(),
  snapshot: vi.fn(),
}))
const document = {
  id: 'history-document',
  path: '/workspace/note.md',
  name: 'note.md',
  workspace: '/workspace',
  generation: 0,
}
vi.mock('./local-history', () => ({
  historyCall: mocks.call,
  historyDocument: async () => document,
  historyDraftIdentity: () => ({ writer: 'main:file', sequence: 3 }),
  bindRecoveredDraft: mocks.bind,
  pauseHistoryAutosave: mocks.pause,
  flushDraftProtection: vi.fn(),
  historyChanged: vi.fn(),
}))
vi.mock('@/components/EditorArea/fileSnapshot', () => ({ readStableFileSnapshot: mocks.snapshot }))
vi.mock('@/components/EditorArea/externalFileChanges', () => ({
  EXTERNAL_FILE_CONTENT_SYNC_EVENT: 'external_file_content_sync',
  markExternalFileConflict: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('zens', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
enableMapSet()
beforeEach(() => {
  vi.clearAllMocks()
  useFileCacheStore.setState({ entries: {}, pathEntries: {}, metadataRevision: 0 })
  useEditorStateStore.setState({ idStateMap: new Map() })
  useEditorStore.setState({
    folderData: [],
    opened: [],
    activeId: undefined,
    activeGroupId: 'group',
    editorLayout: { type: 'leaf', id: 'group', opened: [] },
  })
  mocks.snapshot.mockResolvedValue({
    status: 'success',
    content: 'disk original',
    revision: 'disk:original',
  })
  mocks.call.mockImplementation(async (operation, payload) => {
    if (operation === 'read') return { document, content: 'historical' }
    if (operation === 'restore') return payload.draft
    throw new Error(operation)
  })
})
const open = () => {
  const file = createFile({ name: document.name, path: document.path, content: 'working draft' })
  useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: true })
  useEditorStore.getState().addOpenedFile(file.id)
  useEditorStore.getState().setActiveId(file.id)
  return file
}
describe('restore history into a protected draft', () => {
  it('protects displaced local text before applying a restored draft and pausing autosave', async () => {
    const file = open()
    await restoreHistory('version')
    expect(mocks.call).toHaveBeenCalledWith(
      'restore',
      expect.objectContaining({
        previous: 'working draft',
        draft: expect.objectContaining({ paused: true, writer: 'main:file' }),
      }),
    )
    expect(getFileObject(file.id).content).toBe('historical')
    expect(useEditorStateStore.getState().idStateMap.get(file.id)?.hasUnsavedChanges).toBe(true)
    expect(mocks.pause).toHaveBeenCalledWith(file.id, true)
  })
  it('keeps the current draft unchanged if the selected version was cleared', async () => {
    const file = open()
    const original = mocks.call.getMockImplementation()!
    mocks.call.mockImplementation((operation, payload) =>
      operation === 'restore'
        ? Promise.reject(new Error('history_invalidated'))
        : original(operation, payload),
    )
    await expect(restoreHistory('version')).rejects.toThrow('history_invalidated')
    expect(getFileObject(file.id).content).toBe('working draft')
    expect(mocks.bind).not.toHaveBeenCalled()
    expect(mocks.pause).not.toHaveBeenCalled()
  })
  it('backs up current disk content when restoring a document that is closed', async () => {
    createFile({ name: document.name, path: document.path, content: 'outdated cached text' })
    await restoreHistory('version')
    expect(mocks.call).toHaveBeenCalledWith(
      'restore',
      expect.objectContaining({ previous: 'disk original' }),
    )
  })
})
