import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as HistoryModule from './local-history'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  read: vi.fn(),
  listen: vi.fn(),
  opened: [] as string[],
  dirty: true,
  content: 'draft',
  path: '/workspace/note.md' as string | undefined,
  file: undefined as { id: string; name: string; kind: string; path?: string; content: string } | undefined,
  release: vi.fn(),
  waitForIdle: vi.fn(),
  hasSources: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, isTauri: () => true }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'main' }) }))
vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/helper/files', () => ({
  getFileObject: () => mocks.file ?? { id: 'file', name: 'note.md', path: mocks.path, kind: 'file' },
  releaseFileContent: mocks.release,
}))
vi.mock('@/components/EditorArea/editorSnapshotRegistry', () => ({
  editorSnapshotRegistry: { hasSources: mocks.hasSources },
}))
vi.mock('@/stores/useEditorStore', () => ({
  default: {
    getState: () => ({
      opened: mocks.opened,
      getRootPath: () => '/workspace',
      getEditorContent: mocks.read,
    }),
    subscribe: () => () => {},
  },
}))
vi.mock('@/stores/useEditorStateStore', () => ({
  default: {
    getState: () => ({
      idStateMap: new Map([['file', { hasUnsavedChanges: mocks.dirty }]]),
      delIdStateMap: () => { mocks.dirty = false },
    }),
  },
}))
vi.mock('@/components/EditorArea/fileSaveCoordinator', () => ({
  fileSaveCoordinator: {
    getDiskRevision: () => 'disk:old',
    getPersistedFormat: () => ({ encoding: 'gbk', bom: 'none' }),
    getTextMetadata: () => ({ format: { encoding: 'gbk', bom: 'none' } }),
    recordFormat: vi.fn(),
    waitForIdle: mocks.waitForIdle,
    releaseWhenIdle: async (_id: string, guard: () => boolean, cleanup: () => void) => {
      await mocks.waitForIdle()
      if (!guard()) return false
      cleanup()
      return true
    },
  },
}))

const doc = {
  id: 'document',
  workspace: '/workspace',
  path: '/workspace/note.md',
  name: 'note.md',
  generation: 0,
}
const calls = (operation: string) =>
  mocks.invoke.mock.calls.filter(([, p]) => p.operation === operation).map(([, p]) => p.payload)
let history: typeof HistoryModule

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  mocks.opened = []
  mocks.path = doc.path
  mocks.dirty = true
  mocks.content = 'draft'
  mocks.file = undefined
  mocks.release.mockReset()
  mocks.waitForIdle.mockReset().mockResolvedValue(undefined)
  mocks.hasSources.mockReset().mockReturnValue(false)
  mocks.read.mockReset().mockImplementation(() => mocks.content)
  mocks.listen.mockReset().mockResolvedValue(() => {})
  mocks.invoke
    .mockReset()
    .mockImplementation(async (_command, { operation }) =>
      operation === 'register' || operation === 'document' ? doc : { persisted: true },
    )
  history = await import('./local-history')
  await history.startDraftProtection()
  mocks.opened = ['file']
})
afterEach(() => {
  vi.useRealTimers()
})

describe('background draft protection', () => {
  it('returns only the descriptor of the acknowledged writer and refuses stale exit references', async () => {
    await history.flushDraftProtection('file')
    const persisted = calls('draft').at(-1)
    const original = mocks.invoke.getMockImplementation()!
    let descriptor = { document: doc, writer: persisted.writer, sequence: persisted.sequence, hash: 'sha256', paused: false }
    mocks.invoke.mockImplementation((command, args) => args.operation === 'draftDescriptor'
      ? Promise.resolve(descriptor) : original(command, args))
    expect(await history.protectedDraftDescriptor('file')).toEqual(descriptor)
    expect(calls('draftDescriptor')).toEqual([{ document: doc, writer: persisted.writer }])
    descriptor = { ...descriptor, sequence: persisted.sequence - 1 }
    await expect(history.protectedDraftDescriptor('file')).rejects.toThrow('not been durably protected')
  })
  it('retains the original recovery writer until a hidden draft has been validated', async () => {
    const { registerDraftRecovery } = await import('./draftRecoveryState')
    const ready = registerDraftRecovery('file', vi.fn())
    try {
      history.protectLocalEdit('file')
      await history.flushDraftProtection('file')
      expect(calls('register')).toEqual([])
      expect(calls('draft')).toEqual([])
      ready()
      history.protectLocalEdit('file')
      await history.flushDraftProtection('file')
      expect(calls('draft')).toHaveLength(1)
    } finally {
      ready()
    }
  })

  it('coalesces a thousand edits without serializing on each keystroke', async () => {
    for (let n = 0; n < 1000; n++) {
      mocks.content = `edit ${n}`
      history.protectLocalEdit('file')
    }
    expect(mocks.read).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls('draft')).toHaveLength(1)
    expect(calls('draft')[0].content).toBe('edit 999')
    expect(calls('boundary')).toHaveLength(1)
    expect(history.useHistoryProtection.getState().status.file).toBe('protected')
  })

  it('keeps only the latest pending draft while persistence is slow', async () => {
    let finish!: (value: object) => void
    const original = mocks.invoke.getMockImplementation()!
    mocks.invoke.mockImplementation((command, args) => {
      if (args.operation === 'draft' && !finish)
        return new Promise((resolve) => {
          finish = resolve
        })
      return original(command, args)
    })
    history.protectLocalEdit('file')
    await vi.advanceTimersByTimeAsync(1000)
    for (let n = 0; n < 1000; n++) {
      mocks.content = `later ${n}`
      history.protectLocalEdit('file')
    }
    const flushed = history.flushDraftProtection('file')
    expect(calls('draft')).toHaveLength(1)
    expect(history.useHistoryProtection.getState().status.file).toBe('pending')
    finish({ persisted: true })
    await flushed
    expect(calls('draft')).toHaveLength(2)
    expect(calls('draft')[1].content).toBe('later 999')
    expect(history.useHistoryProtection.getState().status.file).toBe('protected')
  })

  it('persists restored draft pause and retires the same writer after a manual save', async () => {
    await history.historyDocument('file')
    history.pauseHistoryAutosave('file', true)
    await history.flushDraftProtection('file')
    const saved = calls('draft')[0]
    expect(saved.paused).toBe(true)
    mocks.dirty = false
    history.historyFileSaved('file')
    await history.flushDraftProtection('file')
    expect(history.isHistoryAutosavePaused('file')).toBe(false)
    expect(calls('finishDraft').at(-1)).toMatchObject({ writer: saved.writer })
    expect(calls('finishDraft').at(-1).sequence).toBeGreaterThan(saved.sequence)
  })

  it('reports disk failures and retries the newest text', async () => {
    const original = mocks.invoke.getMockImplementation()!
    let fail = true
    mocks.invoke.mockImplementation((command, args) => {
      if (args.operation === 'draft' && fail) return Promise.reject(new Error('disk full'))
      return original(command, args)
    })
    history.protectLocalEdit('file')
    await vi.advanceTimersByTimeAsync(1000)
    expect(history.useHistoryProtection.getState().status.file).toBe('failed')
    fail = false
    mocks.content = 'latest retry'
    await history.flushDraftProtection('file')
    expect(calls('draft').at(-1).content).toBe('latest retry')
    expect(history.useHistoryProtection.getState().status.file).toBe('protected')
  })

  it('assigns outside files to independent history and keeps untitled drafts in their workspace', () => {
    expect(history.historyWorkspaceForPath('/workspace/a.md')).toBe('/workspace')
    expect(history.historyWorkspaceForPath('/workspace-two/a.md')).toBe('')
    expect(history.historyWorkspaceForPath()).toBe('/workspace')
  })
})

describe('closed document content lifetime', () => {
  beforeEach(() => {
    mocks.file = { id: 'file', name: 'note.md', path: mocks.path, kind: 'file', content: 'draft' }
  })

  it('waits for pending saves and rechecks whether the document reopened', async () => {
    mocks.opened = []
    mocks.dirty = false
    let finish!: () => void
    mocks.waitForIdle.mockReturnValue(new Promise<void>((resolve) => { finish = resolve }))
    const release = history.releaseClosedFileContent('file')
    expect(mocks.release).not.toHaveBeenCalled()
    mocks.opened = ['file']
    finish()
    expect(await release).toBe(false)
    expect(mocks.release).not.toHaveBeenCalled()
    mocks.opened = []
    expect(await history.releaseClosedFileContent('file')).toBe(true)
    expect(mocks.release).toHaveBeenCalledExactlyOnceWith('file')
  })

  it('retains dirty text until the exact discarded content is acknowledged', async () => {
    mocks.opened = []
    expect(await history.releaseClosedFileContent('file')).toBe(false)
    await history.protectDiscard(['file'])
    mocks.file = { ...mocks.file!, content: 'edited during checkpoint' }
    expect(await history.releaseClosedFileContent('file')).toBe(false)
    expect(mocks.release).not.toHaveBeenCalled()
    mocks.content = mocks.file.content
    await history.protectDiscard(['file'])
    expect(await history.releaseClosedFileContent('file')).toBe(true)
    expect(mocks.release).toHaveBeenCalledExactlyOnceWith('file')
  })

  it('retains bodies after a failed save or discard checkpoint', async () => {
    mocks.opened = []
    mocks.waitForIdle.mockRejectedValueOnce(new Error('write failed'))
    await expect(history.releaseClosedFileContent('file')).rejects.toThrow('write failed')
    mocks.invoke.mockRejectedValueOnce(new Error('history failed'))
    await expect(history.protectDiscard(['file'])).rejects.toThrow('history failed')
    expect(await history.releaseClosedFileContent('file')).toBe(false)
    expect(mocks.release).not.toHaveBeenCalled()
  })

  it('keeps live editor sources and unvalidated recovery drafts resident', async () => {
    mocks.opened = []
    mocks.dirty = false
    mocks.hasSources.mockReturnValue(true)
    expect(await history.releaseClosedFileContent('file')).toBe(false)
    mocks.hasSources.mockReturnValue(false)
    const { registerDraftRecovery } = await import('./draftRecoveryState')
    const ready = registerDraftRecovery('file', vi.fn())
    expect(await history.releaseClosedFileContent('file')).toBe(false)
    ready()
    expect(await history.releaseClosedFileContent('file')).toBe(true)
  })
})
