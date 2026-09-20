import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runHistoryCli } from './history-cli'
import { contentSha256, type CliRequest } from './cliProtocol'

const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  snapshot: vi.fn(),
  save: vi.fn(),
  content: 'final',
  dirty: false,
}))
const document = {
  id: 'document',
  workspace: '/workspace',
  path: '/workspace/note.md',
  name: 'note.md',
  generation: 0,
}
vi.mock('./local-history', () => ({
  historyCall: mocks.call,
  historyDocument: async () => document,
  historyWorkspaceForPath: () => '/workspace',
}))
vi.mock('@/helper/files', () => ({
  getFileObject: () => ({ id: 'file', path: '/workspace/note.md' }),
}))
vi.mock('@/stores/useEditorStore', () => ({
  default: { getState: () => ({ getEditorContent: () => mocks.content }) },
}))
vi.mock('@/stores/useEditorStateStore', () => ({
  default: {
    getState: () => ({ idStateMap: new Map([['file', { hasUnsavedChanges: mocks.dirty }]]) }),
  },
}))
vi.mock('@/components/EditorArea/fileSnapshot', () => ({ readStableFileSnapshot: mocks.snapshot }))
vi.mock('@/components/EditorArea/editorAutomationRegistry', () => ({
  editorAutomationRegistry: { get: () => ({ readContent: () => mocks.content, save: mocks.save }) },
}))

const request = (
  operation: CliRequest['operation'],
  extra: Partial<CliRequest> = {},
): CliRequest => ({
  protocolVersion: 1,
  requestId: 'transport',
  operationId: 'edit-id',
  operation,
  path: document.path,
  windowId: 'main',
  commandId: null,
  preview: false,
  waitFor: 'applied',
  expectedSha256: null,
  output: null,
  format: null,
  overwrite: false,
  deadline: Date.now() + 30_000,
  ...extra,
})
beforeEach(() => {
  vi.clearAllMocks()
  mocks.content = 'final'
  mocks.dirty = false
  mocks.save.mockResolvedValue(true)
  mocks.snapshot.mockResolvedValue({ status: 'success', content: 'final', revision: 'disk:final' })
  mocks.call.mockImplementation(async (operation) => {
    if (operation === 'drafts' || operation === 'list') return []
    if (operation === 'document' || operation === 'register') return document
    if (operation === 'stats') return { enabled: true }
    if (operation === 'receipt') return null
    if (operation === 'checkpoint') return { versionId: 'version' }
    return { sessionId: 'session', state: 'active', documentId: document.id }
  })
})

describe('history CLI receipts', () => {
  it('captures one baseline before external edits without saving the editor', async () => {
    const result = await runHistoryCli(request('historyBegin'), 'file')
    expect(result.code).toBe('history_started')
    expect(mocks.call).toHaveBeenCalledWith('begin', {
      document,
      content: 'final',
      requestId: 'edit-id',
    })
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('blocks begin when a protected draft exists in another window', async () => {
    const original = mocks.call.getMockImplementation()!
    mocks.call.mockImplementation((operation, payload) =>
      operation === 'begin' ? Promise.reject('content_conflict') : original(operation, payload),
    )
    await expect(runHistoryCli(request('historyBegin'), 'file')).rejects.toMatchObject({
      code: 'content_conflict',
    })
    expect(mocks.call).not.toHaveBeenCalledWith('drafts', expect.anything())
  })
  it('returns committed receipts on retry without sampling a later disk revision', async () => {
    const result = {
      code: 'history_committed',
      sha256: 'same',
      message: 'task',
      versionId: 'version',
    }
    mocks.call.mockResolvedValue({ state: 'committed', result })
    await expect(
      runHistoryCli(
        request('historyCommit', { sessionId: 'session', expectedSha256: 'same', message: 'task' }),
      ),
    ).resolves.toEqual({ code: result.code, result })
    expect(mocks.snapshot).not.toHaveBeenCalled()
    await expect(
      runHistoryCli(
        request('historyCommit', { sessionId: 'session', expectedSha256: 'different' }),
      ),
    ).rejects.toMatchObject({ code: 'request_conflict' })
  })
  it('reports history disabled as an explicit error', async () => {
    const original = mocks.call.getMockImplementation()!
    mocks.call.mockImplementation((operation, payload) =>
      operation === 'begin' ? Promise.reject('history_disabled') : original(operation, payload),
    )
    await expect(runHistoryCli(request('historyBegin'), 'file')).rejects.toMatchObject({
      code: 'history_disabled',
    })
  })
  it('verifies file save and reports no history while the feature is disabled', async () => {
    const original = mocks.call.getMockImplementation()!
    mocks.call.mockImplementation((operation, payload) =>
      operation === 'checkpoint'
        ? Promise.resolve({ versionId: null })
        : original(operation, payload),
    )
    const sha256 = await contentSha256('final')
    const receipt = await runHistoryCli(request('save', { expectedSha256: sha256 }), 'file')
    expect(mocks.save).toHaveBeenCalledWith('final')
    expect(receipt).toEqual({
      code: 'file_saved',
      result: { path: document.path, sha256, historyCreated: false, versionId: undefined },
    })
    expect(mocks.call).toHaveBeenCalledWith(
      'recordReceipt',
      expect.objectContaining({ result: receipt }),
    )
  })
  it('does not save a draft whose content changed since the request', async () => {
    await expect(
      runHistoryCli(request('save', { expectedSha256: await contentSha256('older') }), 'file'),
    ).rejects.toMatchObject({ code: 'content_changed' })
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.call).not.toHaveBeenCalledWith('recordReceipt', expect.anything())
  })
})
