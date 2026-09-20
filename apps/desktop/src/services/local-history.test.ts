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
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, isTauri: () => true }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'main' }) }))
vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/helper/files', () => ({
  getFileObject: () => ({ id: 'file', name: 'note.md', path: mocks.path, kind: 'file' }),
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
    getState: () => ({ idStateMap: new Map([['file', { hasUnsavedChanges: mocks.dirty }]]) }),
  },
}))
vi.mock('@/components/EditorArea/fileSaveCoordinator', () => ({
  fileSaveCoordinator: { getDiskRevision: () => 'disk:old' },
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
    } finally { ready() }
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
