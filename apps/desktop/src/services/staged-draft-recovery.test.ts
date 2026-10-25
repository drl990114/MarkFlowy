import { enableMapSet } from 'immer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import bus from '@/helper/eventBus'
import useFileCacheStore, { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile, updateFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { editorSnapshotRegistry } from '@/components/EditorArea/editorSnapshotRegistry'
import { DEFAULT_TEXT_METADATA } from '@/components/EditorArea/textFileFormat'
import { EXTERNAL_FILE_CONTENT_SYNC_EVENT, markExternalFileConflict } from '@/components/EditorArea/externalFileChanges'
import type { FileSnapshotResult } from '@/components/EditorArea/fileSnapshot'
import {
  closeWithDraftRecovery,
  captureProtectedDraftSession,
  listenForDraftReload,
  RELOAD_SESSION_KEY,
  type DraftDocument,
  type DraftSession,
  type DraftSessionStore,
} from './draft-recovery'
import { isDraftRecoveryPending, keepDraftRecoveryAndClose, waitForDraftRecovery, waitForAllDraftRecovery } from './draftRecoveryState'
import { bindRecoveredDraft, flushDraftProtection, historyCall, historyWorkspace, protectLocalEdit, retainHistoryDraftOnClose } from './local-history'
import { dialog } from './dialog'
import { stageDraftRecovery } from './staged-draft-recovery'
import { nativeRecoveryDocument, type DraftDescriptor, type DraftManifest } from './draftSessionFormat'
import { restoreWindowDocuments, type WindowSession } from './window-session'

const background = vi.hoisted(() => ({ deferred: false, tasks: [] as (() => void)[] }))
const recoveryWindow = vi.hoisted(() => ({ label: 'main' }))
vi.mock('@/startup/interactive', () => ({ afterStartupInteractive: (run: () => void) => {
  if (background.deferred) background.tasks.push(run)
  else run()
  return () => { background.tasks = background.tasks.filter((task) => task !== run) }
} }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => true }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => recoveryWindow }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('zens', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('./dialog', () => ({ dialog: { confirm: vi.fn() } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/components/EditorArea/externalFileChanges', () => ({
  EXTERNAL_FILE_CONTENT_SYNC_EVENT: 'external_file_content_sync',
  markExternalFileConflict: vi.fn(),
}))
vi.mock('./local-history', () => ({
  bindRecoveredDraft: vi.fn().mockResolvedValue(undefined),
  draftProtectionStarted: () => true,
  flushDraftProtection: vi.fn().mockResolvedValue(undefined),
  historyCall: vi.fn().mockResolvedValue([]),
  historyWorkspace: vi.fn(() => '/w'),
  protectLocalEdit: vi.fn(),
  observeHistoryFile: vi.fn().mockResolvedValue(undefined),
  startDraftProtection: vi.fn().mockResolvedValue(undefined),
  protectedDraftDescriptor: vi.fn(async (id: string) => ({
    document: { id, name: 'draft.md', workspace: '/w', generation: 1 },
    writer: `main:${id}`, sequence: 1, hash: id, paused: false,
  })),
  isUntouchedRecoveredDraft: () => true,
  ownsHistoryDraft: () => false,
  retainHistoryDraftOnClose: vi.fn().mockResolvedValue(undefined),
}))

enableMapSet()
const cleanups: (() => void)[] = []
const waits: Promise<unknown>[] = []
const reads = new Map<string, (snapshot: FileSnapshotResult) => void>()
const calls: string[] = []
const snapshot = (content = 'disk', revision = 'r1'): FileSnapshotResult => ({ status: 'success', content, revision })
const draft = (id: string, content = `${id} draft`): DraftDocument => ({ id, name: `${id}.md`, path: `/w/${id}.md`, content, diskRevision: 'r1' })
const diskFingerprint = `existing:1:2:136:1791132580162384580:sha256:${'a'.repeat(64)}`
const savedDiskRevision = `${diskFingerprint}:path-generation:3:file-generation:3`
const restartedDiskRevision = `${diskFingerprint}:path-generation:0:file-generation:0`
const cacheFor = (documents: DraftDocument[], activeId?: string) => {
  const original: DraftSession = { version: 1, documents, activeId }
  const data = new Map<string, unknown>([['draft-session:old', original]])
  const cache: DraftSessionStore = {
    entries: async <T>() => [...data] as [string, T][],
    set: async (key, value) => { data.set(key, value) },
    delete: async (key) => data.delete(key),
    save: vi.fn(async () => {}),
  }
  return { cache, data }
}
const open = (id: string, content?: string) => {
  const file = createFile({ ...draft(id), id, content })
  useEditorStore.getState().addOpenedFile(id)
  return file
}
const start = async (options: Parameters<typeof stageDraftRecovery>[0]) => {
  const controller = new AbortController()
  cleanups.push(() => controller.abort())
  const recovery = await stageDraftRecovery({ ...options, signal: options.signal ?? controller.signal })
  waits.push(recovery.finished)
  return recovery
}
const settle = (id: string, result = snapshot()) => {
  const read = reads.get(`/w/${id}.md`)
  expect(read, `read of ${id} started`).toBeTypeOf('function')
  reads.delete(`/w/${id}.md`)
  read!(result)
}
beforeEach(() => {
  vi.clearAllMocks()
  recoveryWindow.label = 'main'
  vi.mocked(historyCall).mockResolvedValue([])
  vi.mocked(historyWorkspace).mockReturnValue('/w')
  vi.mocked(flushDraftProtection).mockResolvedValue(undefined)
  vi.mocked(bindRecoveredDraft).mockResolvedValue(undefined)
  vi.mocked(dialog.confirm).mockReset().mockResolvedValue('cancel')
  calls.length = 0
  background.deferred = false
  background.tasks.length = 0
  window.sessionStorage.clear()
  useFileCacheStore.setState({ entries: {}, pathEntries: {}, metadataRevision: 0 })
  useEditorStateStore.setState({ idStateMap: new Map() })
  useEditorStore.setState({
    folderData: [], opened: [], activeId: undefined, activeGroupId: 'group',
    editorLayout: { type: 'leaf', id: 'group', opened: [] },
  })
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command !== 'get_file_snapshot') return undefined
    const path = (args as { filePath: string }).filePath
    calls.push(path)
    return new Promise((resolve) => reads.set(path, resolve))
  })
})

const descriptor = (id: string): DraftDescriptor => ({
  document: { id: `native-${id}`, name: `${id}.md`, path: `/w/${id}.md`, workspace: '/w', generation: 1 },
  writer: `old:${id}`, sequence: 12, hash: `hash-${id}`, paused: true, diskRevision: 'r1',
  format: { encoding: 'gb18030', bom: 'none' },
})
const installNative = (drafts: DraftDescriptor[]) => {
  const claimed: string[] = []
  vi.mocked(historyCall).mockImplementation(async (op, payload) => {
    if (op === 'recoveryDraftIndex') return drafts.filter((item) => item.document.workspace === (payload as { workspace: string }).workspace)
    if (op === 'claimRecoveryDraft') {
      const { draft: item, claimId } = payload as { draft: DraftDescriptor; claimId: string }
      claimed.push(item.document.name)
      return { ...item, writer: `${recoveryWindow.label}:${claimId}`, content: `${item.document.name} recovered` }
    }
    throw new Error(`Unexpected operation ${op}`)
  })
  return claimed
}
const setWorkspace = (rootPath?: string) => {
  useEditorStore.setState({ folderData: rootPath ? [createFile({ path: rootPath, kind: 'dir' })] : [] })
  vi.mocked(historyWorkspace).mockReturnValue(rootPath ?? '')
}
const sessionFor = (windowLabel: string, item: DraftDescriptor): WindowSession => ({
  version: 1, windowLabel,
  files: [{ id: 'saved-tab', name: item.document.name, path: item.document.path ?? undefined }],
  editorLayout: { type: 'leaf', id: 'group', opened: ['saved-tab'], activeId: 'saved-tab' },
  activeGroupId: 'group',
  drafts: { version: 2, activeId: 'saved-tab', documents: [{
    ...nativeRecoveryDocument(item), id: 'saved-tab', source: { kind: 'native', draft: item },
  }] },
})

describe('indexed draft recovery', () => {
  it.each(['pending', 'composing'] as const)(
    'keeps %s input while a native draft body is being validated', async (input) => {
      setWorkspace('/w')
      open('typing', 'disk')
      fileSaveCoordinator.recordContent('typing', 'disk')
      fileSaveCoordinator.setDiskRevision('typing', 'r1')
      installNative([descriptor('typing')])
      const onError = vi.fn()
      const synced = vi.fn()
      bus.on(EXTERNAL_FILE_CONTENT_SYNC_EVENT, synced)
      cleanups.push(() => bus.detach(EXTERNAL_FILE_CONTENT_SYNC_EVENT, synced))
      const recovery = await start({ onError })
      let pending = true
      const flush = vi.fn(() => {
        updateFile({ id: 'typing', content: 'new local input' })
        fileSaveCoordinator.recordContent('typing', 'new local input')
        pending = false
        return true
      })
      cleanups.push(editorSnapshotRegistry.register('typing', 'live-editor', {
        canRead: () => input !== 'composing',
        hasPending: () => pending,
        flush,
        isVisible: () => true,
        onSyncDemandChanged: () => {},
      }))
      settle('typing')
      expect(await recovery.finished).toBe(0)
      expect(onError).toHaveBeenCalled()
      expect(bindRecoveredDraft).not.toHaveBeenCalled()
      expect(synced).not.toHaveBeenCalled()
      expect(isDraftRecoveryPending('typing')).toBe(true)
      if (input === 'pending') {
        expect(flush).toHaveBeenCalledOnce()
        expect(getFileObject('typing').content).toBe('new local input')
      } else {
        expect(flush).not.toHaveBeenCalled()
        expect(getFileObject('typing').content).toBe('disk')
      }
    },
  )

  it.each([1, 2])('keeps an explicitly empty main session empty despite old native and v%s exit drafts', async (version) => {
    setWorkspace()
    const previous = descriptor('previous')
    previous.document.workspace = ''
    previous.document.path = undefined
    previous.writer = 'main:previous'
    const session = sessionFor('main', previous)
    session.files = []
    session.editorLayout = { type: 'leaf', id: 'group', opened: [] }
    session.drafts = { version: 2, documents: [] }
    restoreWindowDocuments(session)
    const claimed = installNative([previous])
    const { cache, data } = cacheFor([])
    data.clear()
    const oldExit = { version, documents: version === 1
      ? [{ ...draft('previous'), path: undefined }]
      : [nativeRecoveryDocument(previous)] }
    data.set('draft-session:main:old', oldExit)
    const recovery = await start({ session, cache, onError: vi.fn() })
    expect(await recovery.finished).toBe(0)
    expect(claimed).toEqual([])
    expect(useEditorStore.getState().opened).toEqual([])
    expect(data.get('draft-session:main:old')).toBe(oldExit)
  })

  it('keeps the source writer when a child becomes main and the closed old main has a divergent draft', async () => {
    setWorkspace()
    const saved = descriptor('active')
    saved.document.workspace = ''
    saved.writer = 'main_child:active'
    const closedMain = { ...saved, writer: 'main:previous', hash: 'closed-main-body' }
    const session = sessionFor('main_child', saved)
    restoreWindowDocuments(session)
    const claims: string[] = []
    vi.mocked(historyCall).mockImplementation(async (operation, payload) => {
      if (operation === 'recoveryDraftIndex') return [saved, closedMain]
      const { draft: requested, claimId } = payload as { draft: DraftDescriptor; claimId: string }
      claims.push(requested.writer)
      return { ...requested, writer: `main:${claimId}`, content: requested.writer }
    })
    const recovery = await start({ session, onError: vi.fn() })
    settle('active')
    expect(await recovery.finished).toBe(1)
    expect(claims).toEqual(['main_child:active'])
    expect(useEditorStore.getState().opened).toEqual(['saved-tab'])
    expect(getFileObject('saved-tab').content).toBe('main_child:active')
  })

  it('does not claim ambiguous current-label drafts when the remapped source writer is gone', async () => {
    setWorkspace()
    const saved = descriptor('active')
    saved.document.workspace = ''
    saved.writer = 'main_child:active'
    const first = { ...saved, writer: 'main:first', hash: 'first' }
    const second = { ...saved, writer: 'main:second', hash: 'second' }
    const session = sessionFor('main_child', saved)
    restoreWindowDocuments(session)
    const claims: string[] = []
    vi.mocked(historyCall).mockImplementation(async (operation, payload) => {
      if (operation === 'recoveryDraftIndex') return [first, second]
      const requested = (payload as { draft: DraftDescriptor }).draft
      claims.push(requested.writer)
      return requested.writer === saved.writer ? null : { ...requested, content: requested.writer }
    })
    const recovery = await start({ session, onError: vi.fn() })
    settle('active')
    expect(await recovery.finished).toBe(0)
    expect(claims).toEqual(['main_child:active'])
    expect(useEditorStore.getState().opened).toEqual(['saved-tab'])
    expect(bindRecoveredDraft).not.toHaveBeenCalled()
  })

  it('recovers a newer draft for a listed session path without collecting other same-owner documents', async () => {
    setWorkspace('/w')
    const listed = descriptor('active')
    const unlisted = descriptor('unlisted')
    unlisted.document.path = undefined
    const session = sessionFor('old', listed)
    session.drafts = { version: 2, documents: [] }
    restoreWindowDocuments(session)
    const claimed = installNative([listed, unlisted])
    const recovery = await start({ session, onError: vi.fn() })
    settle('active')
    expect(await recovery.finished).toBe(1)
    expect(claimed).toEqual(['active.md'])
    expect(useEditorStore.getState().opened).toEqual(['saved-tab'])
  })

  it.each([1, 2])('retains unselected documents in a mixed v%s exit snapshot after session recovery', async (version) => {
    setWorkspace('/w')
    const selected = descriptor('selected')
    const session = sessionFor('old', selected)
    session.drafts = { version: 2, documents: [] }
    restoreWindowDocuments(session)
    installNative([])
    const { cache, data } = cacheFor([])
    data.clear()
    const documents = version === 1
      ? [draft('selected'), draft('foreign')]
      : [nativeRecoveryDocument(selected), nativeRecoveryDocument(descriptor('foreign'))]
    const oldExit = { version, rootPath: '/w', activeId: documents[1].id, documents }
    data.set('draft-session:old:mixed', oldExit)
    const recovery = await start({ session, cache, onError: vi.fn() })
    expect(calls).toEqual(['/w/selected.md'])
    settle('selected')
    expect(await recovery.finished).toBe(1)
    expect(useEditorStore.getState().opened).toEqual(['saved-tab'])
    expect(getFileObject('saved-tab').content).toBe(version === 1 ? 'selected draft' : 'selected.md recovered')
    expect(data.get('draft-session:old:mixed')).toEqual({ ...oldExit, documents: [documents[1]] })
    expect(cache.save).toHaveBeenCalled()
  })

  it.each(['/w', ''])('recovers closed drafts only in the current workspace scope (%s)', async (workspace) => {
    setWorkspace(workspace || undefined)
    const own = descriptor('own')
    own.document.workspace = workspace
    own.document.path = undefined
    const foreign = descriptor('foreign')
    foreign.document.workspace = workspace ? '' : '/w'
    foreign.document.path = undefined
    const other = descriptor('other')
    other.document.workspace = '/other'
    const claimed = installNative([own, foreign, other])
    const recovery = await start({ onError: vi.fn() })
    expect(await recovery.finished).toBe(1)
    expect(claimed).toEqual(['own.md'])
    expect(vi.mocked(historyCall).mock.calls.filter(([operation]) => operation === 'recoveryDraftIndex')).toEqual([
      ['recoveryDraftIndex', { workspace, ownerPrefix: 'main:' }],
    ])
    expect(useEditorStore.getState().opened.map((id) => getFileObject(id).content)).toEqual(['own.md recovered'])
  })

  it('restores only the explicit session document from an old scope after attaching a workspace', async () => {
    setWorkspace('/w')
    const saved = descriptor('saved')
    saved.document.workspace = ''
    saved.document.path = undefined
    const unreferenced = descriptor('unreferenced')
    unreferenced.document.workspace = ''
    unreferenced.document.path = undefined
    const session = sessionFor('old', saved)
    restoreWindowDocuments(session)
    const claimed = installNative([saved, unreferenced])
    const recovery = await start({ session, onError: vi.fn() })
    expect(await recovery.finished).toBe(1)
    expect(claimed).toEqual(['saved.md'])
    expect(useEditorStore.getState().opened).toEqual(['saved-tab'])
    expect(useEditorStore.getState().activeId).toBe('saved-tab')
    expect(getFileObject('saved-tab').content).toBe('saved.md recovered')
  })

  it.each(['first', 'second'])('keeps independent standalone window sessions isolated (%s)', async (owner) => {
    setWorkspace()
    recoveryWindow.label = `new-${owner}`
    const drafts = ['first', 'second'].map((id) => {
      const item = descriptor(id)
      item.document.workspace = ''
      item.writer = `${id}:writer`
      return item
    })
    const item = drafts.find((entry) => entry.writer.startsWith(`${owner}:`))!
    const session = sessionFor(owner, item)
    restoreWindowDocuments(session)
    const claimed = installNative(drafts)
    const recovery = await start({ session, isolatedWindow: recoveryWindow.label, freshWindow: true, onError: vi.fn() })
    expect(calls).toEqual([`/w/${owner}.md`])
    settle(owner)
    expect(await recovery.finished).toBe(1)
    expect(claimed).toEqual([`${owner}.md`])
    expect(useEditorStore.getState().opened).toEqual(['saved-tab'])
    expect(getFileObject('saved-tab').content).toBe(`${owner}.md recovered`)
  })

  it('does not scan or consume old native and exit drafts for a fresh window with a reused label', async () => {
    setWorkspace()
    const previous = descriptor('previous')
    previous.document.workspace = ''
    previous.document.path = undefined
    previous.writer = 'main:previous'
    const claimed = installNative([previous])
    const { cache, data } = cacheFor([])
    data.clear()
    data.set('draft-session:main:old', { version: 1, documents: [{ ...draft('previous'), path: undefined }] })
    const entries = vi.spyOn(cache, 'entries')
    const recovery = await start({ cache, isolatedWindow: 'main', freshWindow: true, onError: vi.fn() })
    expect(await recovery.finished).toBe(0)
    expect(claimed).toEqual([])
    expect(historyCall).not.toHaveBeenCalled()
    expect(entries).not.toHaveBeenCalled()
    expect(data.has('draft-session:main:old')).toBe(true)
    expect(useEditorStore.getState().opened).toEqual([])
  })

  it('allows the current page reload snapshot in a fresh window without reviving exit drafts', async () => {
    setWorkspace()
    const { cache, data } = cacheFor([{ ...draft('old-exit'), path: undefined }])
    window.sessionStorage.setItem(RELOAD_SESSION_KEY, JSON.stringify({
      version: 1, documents: [{ ...draft('current-page'), path: undefined }],
    }))
    const recovery = await start({ cache, reload: true, freshWindow: true, onError: vi.fn() })
    expect(await recovery.finished).toBe(1)
    expect(useEditorStore.getState().opened.map((id) => getFileObject(id).content)).toEqual(['current-page draft'])
    expect(window.sessionStorage.getItem(RELOAD_SESSION_KEY)).toBeNull()
    expect(data.has('draft-session:old')).toBe(true)
    expect(historyCall).not.toHaveBeenCalled()
  })

  it('recovers only an explicitly reopened standalone path from a closed owner', async () => {
    recoveryWindow.label = 'main_reopened'
    vi.mocked(historyWorkspace).mockReturnValue('')
    const item = descriptor('active')
    item.document.workspace = ''
    const unrelated = descriptor('other')
    unrelated.document.workspace = ''
    open('active', 'disk baseline')
    useEditorStore.getState().setActiveId('active')
    const claimed = installNative([item, unrelated, descriptor('active')])
    const { cache, data } = cacheFor([draft('active', 'stale exit body'), draft('other')])
    const onError = vi.fn()
    const recovery = await start({
      cache, onError, isolatedWindow: recoveryWindow.label,
      reopenPaths: ['/w/active.md'], preserveOpenDocuments: true,
    })
    expect(claimed).toEqual(['active.md'])
    expect(calls).toEqual(['/w/active.md'])
    settle('active', snapshot('disk baseline'))
    expect(await recovery.finished).toBe(1)
    expect(getFileObject('active').content).toBe('active.md recovered')
    expect(useEditorStore.getState().opened).toEqual(['active'])
    expect(useEditorStore.getState().activeId).toBe('active')
    expect(useEditorStateStore.getState().idStateMap.get('active')?.hasUnsavedChanges).toBe(true)
    expect(historyCall).toHaveBeenCalledWith('recoveryDraftIndex', { workspace: '', ownerPrefix: 'main_reopened:' })
    expect(historyCall).not.toHaveBeenCalledWith('recoveryDraftIndex', expect.objectContaining({ workspace: '/w' }))
    expect(historyCall).toHaveBeenCalledWith('claimRecoveryDraft', {
      draft: item, ownerPrefix: 'main_reopened:', claimId: expect.any(String),
    })
    expect(bindRecoveredDraft).toHaveBeenCalledWith('active', expect.objectContaining({
      document: item.document, writer: expect.stringMatching(/^main_reopened:/),
      content: 'active.md recovered',
    }))
    expect(data.has('draft-session:old')).toBe(true)
    expect(onError).not.toHaveBeenCalled()
  })

  it('does not restore another owner when an isolated window has no explicitly reopened path', async () => {
    recoveryWindow.label = 'main_reopened'
    open('active', 'disk baseline')
    const claimed = installNative([descriptor('active')])
    const recovery = await start({ isolatedWindow: recoveryWindow.label, onError: vi.fn() })
    expect(await recovery.finished).toBe(0)
    expect(claimed).toEqual([])
    expect(calls).toEqual([])
    expect(getFileObject('active').content).toBe('disk baseline')
  })

  it('keeps same-path drafts from other workspace scopes outside explicit reopen recovery', async () => {
    recoveryWindow.label = 'main_reopened'
    const foreign = descriptor('active')
    foreign.document.workspace = ''
    open('active', 'disk baseline')
    const claimed = installNative([foreign])
    const recovery = await start({
      isolatedWindow: recoveryWindow.label, reopenPaths: ['/w/active.md'], onError: vi.fn(),
    })
    expect(await recovery.finished).toBe(0)
    expect(claimed).toEqual([])
    expect(calls).toEqual([])
    expect(getFileObject('active').content).toBe('disk baseline')
  })

  it('leaves the reopened file clean when the native claim rejects a now-live or already claimed owner', async () => {
    recoveryWindow.label = 'main_reopened'
    vi.mocked(historyWorkspace).mockReturnValue('')
    const item = descriptor('active')
    item.document.workspace = ''
    open('active', 'disk baseline')
    useEditorStore.getState().setActiveId('active')
    vi.mocked(historyCall).mockImplementation(async (op) => op === 'recoveryDraftIndex' ? [item] : null)
    const onError = vi.fn()
    const recovery = await start({
      isolatedWindow: recoveryWindow.label, reopenPaths: ['/w/active.md'],
      preserveOpenDocuments: true, onError,
    })
    settle('active', snapshot('disk baseline'))
    expect(await recovery.finished).toBe(0)
    expect(historyCall).toHaveBeenCalledWith('claimRecoveryDraft', expect.objectContaining({ draft: item }))
    expect(getFileObject('active').content).toBe('disk baseline')
    expect(useEditorStore.getState().opened).toEqual(['active'])
    expect(useEditorStateStore.getState().idStateMap.get('active')?.hasUnsavedChanges).toBe(false)
    expect(isDraftRecoveryPending('active')).toBe(false)
    expect(bindRecoveredDraft).not.toHaveBeenCalled()
    expect(protectLocalEdit).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it.each([savedDiskRevision, diskFingerprint])('recovers a saved-then-edited native draft after write counters reset (%s)', async (diskRevision) => {
    const item = { ...descriptor('active'), diskRevision }
    open('active')
    useEditorStore.getState().setActiveId('active')
    installNative([item])
    const onError = vi.fn()
    const recovery = await start({ onError })
    settle('active', snapshot('disk saved before the last edits', restartedDiskRevision))
    await recovery.finished
    expect(onError).not.toHaveBeenCalled()
    // Old descriptors must reach the native claim unchanged; their exact fields
    // protect the ownership transfer even though recovery compares stable fields.
    expect(historyCall).toHaveBeenCalledWith('claimRecoveryDraft', expect.objectContaining({ draft: item }))
    expect(getFileObject('active').content).toBe('active.md recovered')
    expect(useEditorStateStore.getState().idStateMap.get('active')?.hasUnsavedChanges).toBe(true)
    expect(markExternalFileConflict).not.toHaveBeenCalled()
    expect(fileSaveCoordinator.getDiskRevision('active')).toBe(restartedDiskRevision)
  })

  it.each([
    ['device', diskFingerprint.replace('existing:1:', 'existing:9:')],
    ['inode', diskFingerprint.replace('existing:1:2:', 'existing:1:9:')],
    ['length', diskFingerprint.replace(':136:', ':137:')],
    ['mtime', diskFingerprint.replace(':1791132580162384580:', ':1791132580162384581:')],
    ['bytes', diskFingerprint.replace('a'.repeat(64), 'b'.repeat(64))],
    ['unknown format', 'future-revision:1'],
  ])('retains a recovery conflict when %s changed across restart', async (_field, fingerprint) => {
    const item = { ...descriptor('active'), diskRevision: savedDiskRevision }
    open('active')
    useEditorStore.getState().setActiveId('active')
    installNative([item])
    const recovery = await start({ onError: vi.fn() })
    const revision = `${fingerprint}:path-generation:0:file-generation:0`
    settle('active', snapshot('disk', revision))
    await recovery.finished
    expect(getFileObject('active').content).toBe('active.md recovered')
    expect(markExternalFileConflict).toHaveBeenCalledWith('active', revision)
    expect(fileSaveCoordinator.getDiskRevision('active')).toBe(savedDiskRevision)
  })

  it('restores the latest owned draft after closing its folder, retaining its tab id and excluding other windows', async () => {
    setWorkspace()
    const previous = descriptor('untitled')
    previous.document.path = undefined
    const latest = { ...previous, writer: 'main:reclaimed', sequence: 13, hash: 'latest' }
    const other = { ...descriptor('other'), writer: 'another-window:other' }
    const previousMain = { ...descriptor('previous-main'), writer: 'main:previous-main' }
    const session: WindowSession = {
      version: 1, windowLabel: 'old', files: [{ id: 'buffer', name: 'untitled.md' }],
      editorLayout: { type: 'leaf', id: 'group', opened: ['buffer'], activeId: 'buffer' }, activeGroupId: 'group',
      drafts: { version: 2, activeId: 'buffer', documents: [{ id: 'buffer', name: 'untitled.md', source: { kind: 'native', draft: previous } }] },
    }
    restoreWindowDocuments(session)
    const claimed: DraftDescriptor[] = []
    vi.mocked(historyCall).mockImplementation(async (operation, payload) => {
      if (operation === 'recoveryDraftIndex') return (payload as { workspace: string }).workspace === '/w' ? [latest, other, previousMain] : []
      const requested = (payload as { draft: DraftDescriptor }).draft
      claimed.push(requested)
      return requested.writer === latest.writer ? { ...requested, content: 'latest protected text' } : null
    })
    const onError = vi.fn()
    const recovery = await start({ session, onError })
    await recovery.finished
    expect(onError).not.toHaveBeenCalled()
    expect(useEditorStore.getState().opened).toEqual(['buffer'])
    expect(useEditorStore.getState().activeId).toBe('buffer')
    expect(getFileObject('buffer').content).toBe('latest protected text')
    expect(claimed).toEqual([latest])
  })
  it('refreshes a history generation without weakening the exact draft reference', async () => {
    const item = descriptor('active')
    open('active')
    useEditorStore.getState().setActiveId('active')
    const claimed: DraftDescriptor[] = []
    vi.mocked(historyCall).mockImplementation(async (op, payload) => {
      if (op === 'recoveryDraftIndex') return (payload as { workspace: string }).workspace === '/w' ? [item] : []
      if (op === 'document') return { ...item.document, generation: 2 }
      const requested = (payload as { draft: DraftDescriptor }).draft
      claimed.push(requested)
      if (requested.document.generation === 1) throw new Error('history_invalidated')
      return { ...requested, content: 'preserved through history clear' }
    })
    const onError = vi.fn()
    const recovery = await start({ onError })
    settle('active')
    await recovery.finished
    expect(onError).not.toHaveBeenCalled()
    expect(claimed.map((attempt) => attempt.document.generation)).toEqual([1, 2])
    expect(claimed[1]).toEqual({ ...item, document: { ...item.document, generation: 2 } })
    expect(getFileObject('active').content).toBe('preserved through history clear')
  })
  it('refreshes an advanced draft reference and claims its latest body with the same claim id', async () => {
    const item = descriptor('active')
    const latest = {
      ...item, sequence: 13, hash: 'latest-hash', diskRevision: 'r2', paused: false,
      format: { encoding: 'utf-16le' as const, bom: 'utf16le' as const },
    }
    open('active')
    useEditorStore.getState().setActiveId('active')
    const attempts: { draft: DraftDescriptor; claimId: string }[] = []
    vi.mocked(historyCall).mockImplementation(async (op, payload) => {
      if (op === 'recoveryDraftIndex') return (payload as { workspace: string }).workspace === '/w' ? [item] : []
      if (op === 'document') return item.document
      if (op === 'draftDescriptor') return latest
      if (op !== 'claimRecoveryDraft') throw new Error(`Unexpected operation ${op}`)
      const attempt = payload as { draft: DraftDescriptor; claimId: string }
      attempts.push({ ...attempt })
      if (attempt.draft.sequence === item.sequence) throw new Error('history_draft_changed')
      return { ...latest, writer: `main:${attempt.claimId}`, content: 'newest protected body' }
    })
    const onError = vi.fn()
    const recovery = await start({ onError })
    settle('active', snapshot('disk', 'r2'))
    await recovery.finished
    expect(onError).not.toHaveBeenCalled()
    expect(attempts.map((attempt) => attempt.draft)).toEqual([item, latest])
    expect(new Set(attempts.map((attempt) => attempt.claimId)).size).toBe(1)
    expect(historyCall).toHaveBeenCalledWith('draftDescriptor', { document: item.document, writer: item.writer })
    expect(getFileObject('active').content).toBe('newest protected body')
    expect(fileSaveCoordinator.getPersistedFormat('active')).toEqual(latest.format)
    expect(bindRecoveredDraft).toHaveBeenCalledWith('active', expect.objectContaining({ sequence: 13, paused: false }))
    expect(isDraftRecoveryPending('active')).toBe(false)
  })
  it('releases a losing multi-window claim without leaving a dirty empty placeholder or blocking close', async () => {
    open('active', 'known clean disk content')
    useEditorStore.getState().setActiveId('active')
    vi.mocked(historyCall).mockImplementation(async (op, payload) => op === 'recoveryDraftIndex'
      ? (payload as { workspace: string }).workspace === '/w' ? [descriptor('active'), descriptor('untitled')] : []
      : null)
    const recovery = await start({ onError: vi.fn() })
    settle('active'); settle('untitled')
    expect(await recovery.finished).toBe(0)
    expect(useEditorStore.getState().opened).toEqual(['active'])
    expect(getFileObject('active').content).toBe('known clean disk content')
    expect(useEditorStateStore.getState().idStateMap.get('active')?.hasUnsavedChanges).toBe(false)
    expect(isDraftRecoveryPending('active')).toBe(false)
    const { cache } = cacheFor([])
    const close = vi.fn(async () => {})
    await closeWithDraftRecovery(cache, 'main', close)
    expect(close).toHaveBeenCalledOnce()
  })

  it.each(['history_corrupt', 'history_snapshot_mismatch', 'history_draft_changed', 'moved'])
  ('keeps the gate and source when recovery cannot safely refresh (%s)', async (failure) => {
    const item = descriptor('active')
    open('active')
    useEditorStore.getState().setActiveId('active')
    let claims = 0
    vi.mocked(historyCall).mockImplementation(async (op, payload) => {
      if (op === 'recoveryDraftIndex') return (payload as { workspace: string }).workspace === '/w' ? [item] : []
      if (op === 'document') return failure === 'moved' ? { ...item.document, path: '/elsewhere/a.md' } : item.document
      if (op === 'draftDescriptor') return { ...item, sequence: item.sequence + claims }
      claims++
      throw new Error(failure === 'moved' ? 'history_draft_changed' : failure)
    })
    const onError = vi.fn()
    const recovery = await start({ onError })
    settle('active')
    await recovery.finished
    expect(claims).toBe(failure === 'history_draft_changed' ? 3 : 1)
    expect(onError).toHaveBeenCalledOnce()
    expect(isDraftRecoveryPending('active')).toBe(true)
    expect(getFileObject('active').content).toBeUndefined()
    expect(bindRecoveredDraft).not.toHaveBeenCalled()
  })

  it('refreshes an already-claimed draft after a lost response without changing the claim id', async () => {
    const item = descriptor('active')
    open('active')
    useEditorStore.getState().setActiveId('active')
    let claimId = ''
    const latest = { ...item, sequence: 15, hash: 'advanced-claim' }
    vi.mocked(historyCall).mockImplementation(async (op, payload) => {
      if (op === 'recoveryDraftIndex') return (payload as { workspace: string }).workspace === '/w' ? [item] : []
      if (op === 'document') return item.document
      if (op === 'draftDescriptor') {
        const writer = (payload as { writer: string }).writer
        return writer === item.writer ? null : { ...latest, writer }
      }
      const requested = payload as { draft: DraftDescriptor; claimId: string }
      if (!claimId) {
        claimId = requested.claimId
        throw new Error('history_draft_changed')
      }
      expect(requested.claimId).toBe(claimId)
      expect(requested.draft).toEqual(latest)
      return { ...latest, writer: `main:${claimId}`, content: 'advanced claimed body' }
    })
    const onError = vi.fn()
    const recovery = await start({ onError })
    settle('active')
    await recovery.finished
    expect(onError).not.toHaveBeenCalled()
    expect(getFileObject('active').content).toBe('advanced claimed body')
  })
  it('does not request hidden bodies before first paint, and promotes a selected hidden document', async () => {
    background.deferred = true
    const ids = ['active', ...Array.from({ length: 20 }, (_, i) => `hidden-${i}`)]
    ids.forEach((id) => open(id))
    useEditorStore.getState().setActiveId('active')
    const claimed = installNative(ids.map(descriptor))
    const recovery = await start({ onError: vi.fn() })
    expect(claimed).toEqual(['active.md'])
    expect(calls).toEqual(['/w/active.md'])
    expect(getFileObject('hidden-19').content).toBeUndefined()
    settle('active')
    await recovery.visibleReady
    expect(getFileObject('active').content).toBe('active.md recovered')
    expect(isDraftRecoveryPending('hidden-19')).toBe(true)
    const selected = waitForDraftRecovery('hidden-19')
    expect(claimed).toEqual(['active.md', 'hidden-19.md'])
    settle('hidden-19')
    await selected
    expect(getFileObject('hidden-19').content).toBe('hidden-19.md recovered')
  })

  it('keeps an unrequested native reference through a synchronous reload', async () => {
    background.deferred = true
    open('active'); open('hidden')
    useEditorStore.getState().setActiveId('active')
    const claimed = installNative([descriptor('active'), descriptor('hidden')])
    const recovery = await start({ onError: vi.fn() })
    settle('active')
    await recovery.visibleReady
    cleanups.push(listenForDraftReload({ canSave: () => true, onError: vi.fn() }))
    window.dispatchEvent(new Event('beforeunload'))
    const manifest = JSON.parse(window.sessionStorage.getItem(RELOAD_SESSION_KEY)!) as DraftManifest
    expect(manifest.version).toBe(2)
    expect(manifest.documents.find((doc) => doc.id === 'hidden')?.source).toEqual({ kind: 'native', draft: descriptor('hidden') })
    expect(claimed).toEqual(['active.md'])
    expect(manifest.documents.every((doc) => !('content' in doc))).toBe(true)
  })

  it('starts hidden work for close even when first paint has not happened and writes only references', async () => {
    background.deferred = true
    open('active'); open('hidden')
    useEditorStore.getState().setActiveId('active')
    const claimed = installNative([descriptor('active'), descriptor('hidden')])
    const recovery = await start({ onError: vi.fn() })
    settle('active')
    await recovery.visibleReady
    const { cache, data } = cacheFor([])
    const close = vi.fn(async () => {})
    const closing = closeWithDraftRecovery(cache, 'main', close)
    expect(claimed).toEqual(['active.md', 'hidden.md'])
    expect(close).not.toHaveBeenCalled()
    settle('hidden')
    await closing
    expect(close).toHaveBeenCalledOnce()
    const sessions = [...data.values()].filter((value) => (value as DraftManifest).version === 2) as DraftManifest[]
    expect(sessions).toHaveLength(1)
    expect(sessions[0].documents.map((doc) => doc.source.kind)).toEqual(['native', 'native'])
    expect(JSON.stringify(sessions[0])).not.toContain('recovered')
  })

  it('retains a failed body reference, blocks close, and retries the same claim id without publishing empty text', async () => {
    background.deferred = true
    open('active')
    useEditorStore.getState().setActiveId('active')
    const item = descriptor('active')
    let fail = true
    const claims: string[] = []
    vi.mocked(historyCall).mockImplementation(async (op, payload) => {
      if (op === 'recoveryDraftIndex') return (payload as { workspace: string }).workspace === '/w' ? [item] : []
      const claimId = (payload as { claimId: string }).claimId
      claims.push(claimId)
      if (fail) throw new Error('IPC reply lost')
      return { ...item, writer: `main:${claimId}`, content: 'retained body' }
    })
    const reference = nativeRecoveryDocument(item)
    const { cache, data } = cacheFor([])
    data.set('draft-session:old', { version: 2, documents: [{ ...reference, source: { kind: 'native', draft: item } }] })
    const recovery = await start({ cache, onError: vi.fn() })
    settle('active')
    await recovery.finished
    expect(isDraftRecoveryPending('active')).toBe(true)
    expect(getFileObject('active').content).toBeUndefined()
    const close = vi.fn(async () => {})
    await expect(closeWithDraftRecovery(cache, 'main', close)).resolves.toBe(false)
    expect(close).not.toHaveBeenCalled()
    expect(dialog.confirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'drafts.restore_failed',
      actions: expect.arrayContaining([{ id: 'keep', label: 'drafts.keep_and_close' }]),
    }))
    expect(data.has('draft-session:old')).toBe(true)
    fail = false
    const retry = waitForAllDraftRecovery()
    // The failed attempt may still own an in-flight disk read; retry reuses it.
    settle('active')
    await retry
    expect(new Set(claims).size).toBe(1)
    expect(getFileObject('active').content).toBe('retained body')
    expect(isDraftRecoveryPending('active')).toBe(false)
  })

  it('uses the current body revision and encoding when an exit manifest points to a retired writer', async () => {
    const old = descriptor('active')
    const current = { ...old, writer: 'new:active', sequence: 20, diskRevision: 'r2', format: { encoding: 'utf-16le' as const, bom: 'utf16le' as const } }
    open('active')
    useEditorStore.getState().setActiveId('active')
    vi.mocked(historyCall).mockImplementation(async (op, payload) => {
      if (op === 'recoveryDraftIndex') return (payload as { workspace: string }).workspace === '/w' ? [current] : []
      return (payload as { draft: DraftDescriptor }).draft.writer === old.writer ? null : { ...current, content: 'newer body' }
    })
    const { cache, data } = cacheFor([])
    data.set('draft-session:old', { version: 2, documents: [nativeRecoveryDocument(old)] })
    const recovery = await start({ cache, onError: vi.fn() })
    settle('active', snapshot('disk', 'r2'))
    await recovery.finished
    expect(getFileObject('active').content).toBe('newer body')
    expect(fileSaveCoordinator.getDiskRevision('active')).toBe('r2')
    expect(fileSaveCoordinator.getPersistedFormat('active')).toEqual(current.format)
    expect(markExternalFileConflict).not.toHaveBeenCalled()
  })

  it('retains a failed native reference durably before closing the tab and window', async () => {
    const item = descriptor('active')
    open('active')
    useEditorStore.getState().setActiveId('active')
    vi.mocked(historyCall).mockImplementation(async (op, payload) => {
      if (op === 'recoveryDraftIndex') return (payload as { workspace: string }).workspace === '/w' ? [item] : []
      throw new Error('history_corrupt')
    })
    const { cache, data } = cacheFor([])
    const recovery = await start({ cache, onError: vi.fn() })
    settle('active')
    await recovery.finished
    const oldKeys = new Set(data.keys())
    let persisted = false
    vi.mocked(cache.save).mockImplementation(async () => {
      if (isDraftRecoveryPending('active')) {
        expect(useEditorStore.getState().opened).toContain('active')
        persisted = true
      }
    })
    vi.mocked(dialog.confirm).mockResolvedValue('keep')
    const close = vi.fn(async () => {
      expect(persisted).toBe(true)
      expect(useEditorStore.getState().opened).not.toContain('active')
      // The real window-close callback flushes this session again.
      await expect(captureProtectedDraftSession()).resolves.toMatchObject({ documents: [] })
    })
    await expect(closeWithDraftRecovery(cache, 'main', close)).resolves.toBe(true)
    const retained = [...data].filter(([key]) => !oldKeys.has(key))
      .map(([, session]) => session as DraftManifest)
      .find((session) => session.documents.length)
    expect(retained?.documents[0].source).toEqual({ kind: 'native', draft: item, claimId: expect.any(String) })
    expect(close).toHaveBeenCalledOnce()
    expect(isDraftRecoveryPending('active')).toBe(false)
    expect(retainHistoryDraftOnClose).toHaveBeenCalledWith('active')
    expect(historyCall).not.toHaveBeenCalledWith('finishDraft', expect.anything())
    expect(historyCall).not.toHaveBeenCalledWith('checkpoint', expect.anything())
    expect(protectLocalEdit).not.toHaveBeenCalled()
  })

  it('keeps the tab gated if retaining it fails and allows another keep attempt', async () => {
    const item = descriptor('active')
    open('active')
    useEditorStore.getState().setActiveId('active')
    vi.mocked(historyCall).mockImplementation(async (op, payload) => {
      if (op === 'recoveryDraftIndex') return (payload as { workspace: string }).workspace === '/w' ? [item] : []
      throw new Error('history_corrupt')
    })
    const { cache, data } = cacheFor([])
    const recovery = await start({ cache, onError: vi.fn() })
    settle('active')
    await recovery.finished
    const originalKeys = [...data.keys()]
    vi.mocked(cache.save).mockRejectedValueOnce(new Error('disk full'))
    await expect(keepDraftRecoveryAndClose('active')).rejects.toThrow('disk full')
    expect(isDraftRecoveryPending('active')).toBe(true)
    expect(useEditorStore.getState().opened).toContain('active')
    expect(retainHistoryDraftOnClose).not.toHaveBeenCalled()
    expect([...data.keys()]).toEqual(originalKeys)
    await keepDraftRecoveryAndClose('active')
    expect(isDraftRecoveryPending('active')).toBe(false)
    expect(useEditorStore.getState().opened).not.toContain('active')
  })

  it('rolls back a retained snapshot if the document changes before close', async () => {
    const item = descriptor('active')
    open('active')
    useEditorStore.getState().setActiveId('active')
    vi.mocked(historyCall).mockImplementation(async (op, payload) => {
      if (op === 'recoveryDraftIndex') return (payload as { workspace: string }).workspace === '/w' ? [item] : []
      throw new Error('history_corrupt')
    })
    const { cache, data } = cacheFor([])
    const recovery = await start({ cache, onError: vi.fn() })
    settle('active')
    await recovery.finished
    const originalKeys = [...data.keys()]
    vi.mocked(cache.save).mockImplementationOnce(async () => { updateFile({ id: 'active', content: 'new content' }) })
    await expect(keepDraftRecoveryAndClose('active')).rejects.toThrow('document changed')
    expect(isDraftRecoveryPending('active')).toBe(true)
    expect(useEditorStore.getState().opened).toContain('active')
    expect(getFileObject('active').content).toBe('new content')
    expect([...data.keys()]).toEqual(originalKeys)
    expect(retainHistoryDraftOnClose).not.toHaveBeenCalled()
  })

  it('retains published text after a binding failure and recovers it on the next startup', async () => {
    const item = descriptor('active')
    open('active')
    useEditorStore.getState().setActiveId('active')
    installNative([item])
    vi.mocked(bindRecoveredDraft).mockRejectedValue(new Error('binding failed'))
    const { cache, data } = cacheFor([])
    const recovery = await start({ cache, onError: vi.fn() })
    settle('active')
    await recovery.finished
    expect(getFileObject('active').content).toBe('active.md recovered')
    await keepDraftRecoveryAndClose('active')
    const bodySession = [...data.values()].find((value) => (value as DraftSession).version === 1) as DraftSession
    expect(bodySession.documents[0].content).toBe('active.md recovered')
    vi.mocked(bindRecoveredDraft).mockResolvedValue(undefined)
    vi.mocked(historyCall).mockImplementation(async (op) => op === 'recoveryDraftIndex' ? [] : null)
    const restored = await start({ cache, onError: vi.fn() })
    settle('active')
    await restored.finished
    expect(useEditorStore.getState().opened.map((id) => getFileObject(id).content)).toEqual(['active.md recovered'])
  })

  it('preserves divergent native writers as separate drafts instead of overwriting one', async () => {
    const first = descriptor('active')
    const second = { ...first, writer: 'other:active', hash: 'another-hash' }
    open('active')
    useEditorStore.getState().setActiveId('active')
    vi.mocked(historyCall).mockImplementation(async (op, payload) => {
      if (op === 'recoveryDraftIndex') return (payload as { workspace: string }).workspace === '/w' ? [first, second] : []
      const item = (payload as { draft: DraftDescriptor }).draft
      return { ...item, content: item.writer }
    })
    const recovery = await start({ onError: vi.fn() })
    settle('active')
    await recovery.finished
    const files = useEditorStore.getState().opened.map(getFileObject)
    expect(files.map((file) => file.content)).toEqual(['old:active', 'other:active'])
    expect(files[1].path).toBeUndefined()
  })
})
afterEach(async () => {
  background.tasks.splice(0).forEach((run) => run())
  cleanups.splice(0).reverse().forEach((cleanup) => cleanup())
  // Drain actual queued reads, including native work whose consumer was aborted.
  for (let i = 0; i < 20; i++) {
    reads.forEach((resolve) => resolve(snapshot()))
    reads.clear()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  await Promise.all(waits.splice(0))
})

describe('staged draft recovery', () => {
  it.each(['exit', 'session'] as const)(
    'preserves pending live input when an inline %s draft still matches the stale cache', async (source) => {
      const id = 'inline-pending'
      open(id, 'old')
      fileSaveCoordinator.recordContent(id, 'old')
      useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: true })
      let live = 'old plus new input'
      let pending = true
      cleanups.push(editorSnapshotRegistry.register(id, 'live-editor', {
        canRead: () => true,
        hasPending: () => pending,
        flush: () => {
          updateFile({ id, content: live })
          fileSaveCoordinator.recordContent(id, live)
          pending = false
          return true
        },
        isVisible: () => true,
        onSyncDemandChanged: () => {},
      }))
      const sync = ({ fileId, content }: { fileId: string; content: string }) => {
        if (fileId !== id) return
        live = content
        pending = false
      }
      bus.on(EXTERNAL_FILE_CONTENT_SYNC_EVENT, sync)
      cleanups.push(() => bus.detach(EXTERNAL_FILE_CONTENT_SYNC_EVENT, sync))
      const { cache } = cacheFor([draft(id, 'old')])
      const session: WindowSession | undefined = source === 'session' ? {
        version: 1, windowLabel: 'old', files: [{ id, name: `${id}.md`, path: `/w/${id}.md` }],
        editorLayout: { type: 'leaf', id: 'group', opened: [id], activeId: id },
        activeGroupId: 'group', drafts: { version: 1, documents: [draft(id, 'old')] },
      } : undefined
      const recovery = await start({ cache: source === 'exit' ? cache : undefined, session, onError: vi.fn() })
      if (reads.has(`/w/${id}.md`)) settle(id, snapshot('old'))
      expect(await recovery.finished).toBe(1)
      expect(live).toBe('old plus new input')
      expect(getFileObject(id).content).toBe(live)
      expect(useEditorStore.getState().opened.map(getFileObject)).toEqual(expect.arrayContaining([
        expect.objectContaining({ id, path: `/w/${id}.md`, content: live }),
        expect.objectContaining({ path: undefined, content: 'old' }),
      ]))
    },
  )

  it('restores other inline drafts without reading or replacing an active composition', async () => {
    const id = 'inline-composing'
    open(id, 'old')
    open('other-inline')
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: true })
    const flush = vi.fn(() => false)
    cleanups.push(editorSnapshotRegistry.register(id, 'live-editor', {
      canRead: () => false,
      hasPending: () => true,
      flush,
      isVisible: () => true,
      onSyncDemandChanged: () => {},
    }))
    const synced = vi.fn()
    bus.on(EXTERNAL_FILE_CONTENT_SYNC_EVENT, synced)
    cleanups.push(() => bus.detach(EXTERNAL_FILE_CONTENT_SYNC_EVENT, synced))
    const { cache, data } = cacheFor([draft(id, 'old'), draft('other-inline', 'other draft')])
    const onError = vi.fn()
    const recovery = await start({ cache, onError })
    settle('other-inline')
    expect(await recovery.finished).toBe(2)
    expect(onError).not.toHaveBeenCalled()
    expect(flush).not.toHaveBeenCalled()
    expect(synced).not.toHaveBeenCalledWith(expect.objectContaining({ fileId: id }))
    expect(data.has('draft-session:old')).toBe(false)
    expect(getFileObject(id).content).toBe('old')
    expect(getFileObject('other-inline').content).toBe('other draft')
    expect(editorSnapshotRegistry.hasPending(id)).toBe(true)
    expect(useEditorStore.getState().opened.map(getFileObject)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id, path: `/w/${id}.md`, content: 'old' }),
      expect.objectContaining({ path: undefined, content: 'old' }),
    ]))
  })

  it.each([
    ['exit', '/w', undefined], ['reload', '/w', undefined],
    ['exit', undefined, '/w'], ['reload', undefined, '/w'],
    ['exit', '/w', '/other'], ['reload', '/w', '/other'],
  ] as const)('retains a %s snapshot from another scope (%s versus %s)', async (source, currentRoot, savedRoot) => {
    setWorkspace(currentRoot)
    const original: DraftSession = {
      version: 1, rootPath: savedRoot, documents: [{ ...draft('foreign'), path: undefined }],
    }
    const { cache, data } = cacheFor([])
    data.set('draft-session:old', original)
    const raw = JSON.stringify(original)
    if (source === 'reload') window.sessionStorage.setItem(RELOAD_SESSION_KEY, raw)
    const recovery = await start({ cache: source === 'exit' ? cache : undefined, reload: source === 'reload', onError: vi.fn() })
    expect(await recovery.finished).toBe(0)
    expect(useEditorStore.getState().opened).toEqual([])
    expect(calls).toEqual([])
    if (source === 'reload') expect(window.sessionStorage.getItem(RELOAD_SESSION_KEY)).toBe(raw)
    else expect(data.get('draft-session:old')).toBe(original)
    expect(protectLocalEdit).not.toHaveBeenCalled()
  })

  it('makes the active draft ready without waiting for hidden reads and caps background concurrency', async () => {
    for (const id of ['active', 'one', 'two', 'three']) open(id)
    useEditorStore.getState().setActiveId('active')
    const { cache, data } = cacheFor(['one', 'two', 'three', 'active'].map((id) => draft(id)))
    const recovery = await start({ cache, onError: vi.fn() })
    expect(calls).toEqual(['/w/active.md', '/w/one.md', '/w/two.md'])
    expect(getFileObject('three').content).toBe('three draft')
    expect(isDraftRecoveryPending('three')).toBe(true)
    expect(protectLocalEdit).not.toHaveBeenCalled()
    settle('active')
    await recovery.visibleReady
    expect(isDraftRecoveryPending('active')).toBe(false)
    expect(isDraftRecoveryPending('one')).toBe(true)
    expect(data.has('draft-session:old')).toBe(true)
    expect(calls).not.toContain('/w/three.md')
  })

  it('promotes a newly selected hidden draft into the reserved foreground slot', async () => {
    for (const id of ['clean', 'one', 'two', 'three', 'four']) open(id)
    useEditorStore.getState().setActiveId('clean')
    const { cache } = cacheFor(['one', 'two', 'three', 'four'].map((id) => draft(id)))
    const recovery = await start({ cache, onError: vi.fn() })
    await recovery.visibleReady
    expect(calls).toEqual(['/w/one.md', '/w/two.md'])
    useEditorStore.getState().setActiveId('four')
    const ready = waitForDraftRecovery('four')
    expect(calls).toEqual(['/w/one.md', '/w/two.md', '/w/four.md'])
    settle('four')
    await ready
    expect(isDraftRecoveryPending('four')).toBe(false)
    expect(useEditorStore.getState().activeId).toBe('four')
    settle('one')
    settle('two')
    await vi.waitFor(() => expect(calls).toContain('/w/three.md'))
    settle('three')
    await recovery.finished
    expect(useEditorStore.getState().activeId).toBe('four')
  })

  it('makes the selected split ready independently, without changing the selected group', async () => {
    for (const id of ['left', 'right', 'hidden']) open(id)
    useEditorStore.setState({ activeId: 'left', activeGroupId: 'left-group', editorLayout: {
      type: 'branch', id: 'split', direction: 'horizontal', sizes: [50, 50], children: [
        { type: 'leaf', id: 'left-group', opened: ['left', 'hidden'], activeId: 'left' },
        { type: 'leaf', id: 'right-group', opened: ['right'], activeId: 'right' },
      ],
    } })
    const { cache } = cacheFor(['left', 'right', 'hidden'].map((id) => draft(id)))
    const recovery = await start({ cache, onError: vi.fn() })
    const ready = vi.fn()
    void recovery.visibleReady.then(ready)
    settle('left')
    await vi.waitFor(() => expect(isDraftRecoveryPending('left')).toBe(false))
    await recovery.visibleReady
    expect(ready).toHaveBeenCalledOnce()
    expect(isDraftRecoveryPending('right')).toBe(true)
    settle('right')
    await recovery.visibleReady
    expect(isDraftRecoveryPending('hidden')).toBe(true)
    expect(useEditorStore.getState().activeGroupId).toBe('left-group')
  })

  it('keeps new input and pending drafts in a reload snapshot, without later deleting it', async () => {
    open('active')
    open('hidden')
    useEditorStore.getState().setActiveId('active')
    window.sessionStorage.setItem(RELOAD_SESSION_KEY, JSON.stringify({
      version: 1, documents: [draft('active'), draft('hidden')], activeId: 'active',
    }))
    const recovery = await start({ reload: true, onError: vi.fn() })
    settle('active')
    await recovery.visibleReady
    updateFile({ id: 'active', content: 'new input' })
    cleanups.push(listenForDraftReload({ canSave: () => true, onError: vi.fn() }))
    window.dispatchEvent(new Event('beforeunload'))
    const raw = window.sessionStorage.getItem(RELOAD_SESSION_KEY)
    const saved = JSON.parse(raw!) as DraftManifest
    expect(saved.documents.map((doc) => doc.source.kind === 'reload'
      ? JSON.parse(window.sessionStorage.getItem(doc.source.key)!) : undefined)).toEqual(['new input', 'hidden draft'])
    settle('hidden')
    await recovery.finished
    expect(window.sessionStorage.getItem(RELOAD_SESSION_KEY)).toBe(raw)
  })

  it('waits for pending recovery before normal close and captures the latest versions', async () => {
    open('active')
    open('hidden')
    useEditorStore.getState().setActiveId('active')
    const { cache, data } = cacheFor([draft('active'), draft('hidden')])
    const recovery = await start({ cache, onError: vi.fn() })
    settle('active')
    await recovery.visibleReady
    updateFile({ id: 'active', content: 'latest input' })
    const close = vi.fn(async () => {})
    const closing = closeWithDraftRecovery(cache, 'main', close)
    await Promise.resolve()
    expect(close).not.toHaveBeenCalled()
    settle('hidden')
    await closing
    expect(close).toHaveBeenCalledOnce()
    const sessions = [...data.values()] as DraftManifest[]
    expect(sessions.some((session) => session.version === 2 && session.documents.some((doc) => doc.id === 'active'))).toBe(true)
    expect(getFileObject('active').content).toBe('latest input')
    expect(sessions.some((session) => session.documents.some((doc) => doc.id === 'hidden'))).toBe(true)
    expect(getFileObject('hidden').content).toBe('hidden draft')
  })

  it('applies native then exit precedence before reads, preserving a divergent live edit', async () => {
    open('same')
    open('live', 'newer live input')
    useEditorStateStore.getState().setIdStateMap('live', { hasUnsavedChanges: true })
    const native = {
        document: { id: 'native', name: 'same.md', path: '/w/same.md', workspace: '/w', generation: 1 },
        writer: 'main:old', sequence: 1, hash: 'hash', diskRevision: 'r1', paused: true,
      }
    vi.mocked(historyCall).mockImplementation(async (op, payload) => op === 'claimRecoveryDraft'
      ? { ...native, content: 'older native' }
      : (payload as { workspace: string }).workspace === '/w' ? [native] : [])
    const { cache } = cacheFor([draft('same', 'latest exit'), draft('live', 'older exit')], 'same')
    const recovery = await start({ cache, onError: vi.fn() })
    expect(getFileObject('same').content).toBe('latest exit')
    expect(getFileObject('live').content).toBe('newer live input')
    expect(useEditorStore.getState().opened.map(getFileObject).some((file) => !file.path && file.content === 'older exit')).toBe(true)
    expect(calls).toEqual(['/w/same.md'])
    settle('same')
    await recovery.finished
    expect(bindRecoveredDraft).toHaveBeenCalledWith('same', expect.objectContaining({ content: 'latest exit', paused: true }))
    expect(useEditorStore.getState().activeId).toBe('same')
  })

  it('retains recovery sources when durable protection fails', async () => {
    open('one')
    const { cache, data } = cacheFor([draft('one')])
    const onError = vi.fn()
    vi.mocked(flushDraftProtection).mockRejectedValue(new Error('disk full'))
    const recovery = await start({ cache, onError })
    settle('one')
    expect(await recovery.finished).toBe(0)
    expect(data.has('draft-session:old')).toBe(true)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'disk full' }))
    expect(getFileObject('one').content).toBe('one draft')
  })

  it.each(['abort', 'workspace', 'close'] as const)('rejects a late result after %s without resurrecting drafts', async (action) => {
    open('one')
    const { cache, data } = cacheFor([draft('one')])
    const controller = new AbortController()
    const recovery = await start({ cache, signal: controller.signal, onError: vi.fn() })
    if (action === 'abort') controller.abort()
    if (action === 'workspace') useEditorStore.getState().setFolderData([createFile({ kind: 'dir', path: '/other' })])
    if (action === 'close') useEditorStore.getState().delOpenedFile('one')
    settle('one', snapshot('new disk', 'r2'))
    await recovery.finished
    expect(data.has('draft-session:old')).toBe(true)
    expect(bindRecoveredDraft).not.toHaveBeenCalled()
    expect(markExternalFileConflict).not.toHaveBeenCalled()
    if (action !== 'abort') expect(useEditorStore.getState().opened).not.toContain('one')
  })

  it('keeps newer content that arrived during validation and checks the original disk baseline', async () => {
    open('one')
    const { cache } = cacheFor([draft('one')])
    const recovery = await start({ cache, onError: vi.fn() })
    updateFile({ id: 'one', content: 'live content' })
    fileSaveCoordinator.recordContent('one', 'live content')
    settle('one', snapshot('changed externally', 'r2'))
    await recovery.finished
    expect(getFileObject('one').content).toBe('live content')
    expect(markExternalFileConflict).toHaveBeenCalledWith('one', 'r2')
    expect(fileSaveCoordinator.getDiskRevision('one')).toBe('r1')
  })

  it('does not replace a newer disk revision published while validation was pending', async () => {
    open('one')
    const { cache, data } = cacheFor([draft('one')])
    const recovery = await start({ cache, onError: vi.fn() })
    updateFile({ id: 'one', content: 'newly saved' })
    fileSaveCoordinator.setDiskRevision('one', 'r3')
    useEditorStateStore.getState().setIdStateMap('one', { hasUnsavedChanges: false })
    settle('one', snapshot('obsolete disk', 'r2'))
    await recovery.finished
    expect(getFileObject('one').content).toBe('newly saved')
    expect(fileSaveCoordinator.getDiskRevision('one')).toBe('r3')
    expect(useEditorStateStore.getState().idStateMap.get('one')?.hasUnsavedChanges).toBe(false)
    expect(markExternalFileConflict).not.toHaveBeenCalled()
    expect(data.has('draft-session:old')).toBe(true)
  })

  it('retains a newer format-only edit while matching recovered text against disk', async () => {
    open('format')
    const { cache } = cacheFor([{ ...draft('format', 'same'), format: { encoding: 'utf-8', bom: 'none' } }])
    const recovery = await start({ cache, onError: vi.fn() })
    fileSaveCoordinator.recordFormat('format', { encoding: 'utf-16be', bom: 'utf16be' })
    settle('format', { status: 'success', content: 'same', revision: 'r1', text: DEFAULT_TEXT_METADATA })
    await recovery.finished
    expect(fileSaveCoordinator.getPersistedFormat('format')).toEqual({ encoding: 'utf-16be', bom: 'utf16be' })
    expect(useEditorStateStore.getState().idStateMap.get('format')?.hasUnsavedChanges).toBe(true)
    expect(fileSaveCoordinator.hasFormatChanges('format')).toBe(true)
    expect(markExternalFileConflict).not.toHaveBeenCalled()
  })

  it('recovers a missing file as the same untitled draft, retaining its tab and content', async () => {
    open('gone')
    const { cache } = cacheFor([draft('gone')])
    const recovery = await start({ cache, onError: vi.fn() })
    settle('gone', { status: 'unstable' })
    await recovery.finished
    expect(getFileObject('gone')).toMatchObject({ path: undefined, content: 'gone draft' })
    expect(getFileObjectByPath('/w/gone.md')).toBeUndefined()
    expect(useEditorStore.getState().opened).toEqual(['gone'])
  })
})
