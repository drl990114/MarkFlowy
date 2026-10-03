import { enableMapSet } from 'immer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import useFileCacheStore, { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile, updateFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { DEFAULT_TEXT_METADATA } from '@/components/EditorArea/textFileFormat'
import { markExternalFileConflict } from '@/components/EditorArea/externalFileChanges'
import type { FileSnapshotResult } from '@/components/EditorArea/fileSnapshot'
import {
  closeWithDraftRecovery,
  listenForDraftReload,
  RELOAD_SESSION_KEY,
  type DraftDocument,
  type DraftSession,
  type DraftSessionStore,
} from './draft-recovery'
import { isDraftRecoveryPending, waitForDraftRecovery, waitForAllDraftRecovery } from './draftRecoveryState'
import { bindRecoveredDraft, flushDraftProtection, historyCall, protectLocalEdit } from './local-history'
import { stageDraftRecovery } from './staged-draft-recovery'
import { nativeRecoveryDocument, type DraftDescriptor, type DraftManifest } from './draftSessionFormat'
import { restoreWindowDocuments, type WindowSession } from './window-session'

const background = vi.hoisted(() => ({ deferred: false, tasks: [] as (() => void)[] }))
vi.mock('@/startup/interactive', () => ({ afterStartupInteractive: (run: () => void) => {
  if (background.deferred) background.tasks.push(run)
  else run()
  return () => { background.tasks = background.tasks.filter((task) => task !== run) }
} }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => true }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'main' }) }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('zens', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/components/EditorArea/externalFileChanges', () => ({ markExternalFileConflict: vi.fn() }))
vi.mock('./local-history', () => ({
  bindRecoveredDraft: vi.fn().mockResolvedValue(undefined),
  draftProtectionStarted: () => true,
  flushDraftProtection: vi.fn().mockResolvedValue(undefined),
  historyCall: vi.fn().mockResolvedValue([]),
  historyWorkspace: () => '/w',
  protectLocalEdit: vi.fn(),
  observeHistoryFile: vi.fn().mockResolvedValue(undefined),
  startDraftProtection: vi.fn().mockResolvedValue(undefined),
  protectedDraftDescriptor: vi.fn(async (id: string) => ({
    document: { id, name: 'draft.md', workspace: '/w', generation: 1 },
    writer: `main:${id}`, sequence: 1, hash: id, paused: false,
  })),
  isUntouchedRecoveredDraft: () => true,
  ownsHistoryDraft: () => false,
}))

enableMapSet()
const cleanups: (() => void)[] = []
const waits: Promise<unknown>[] = []
const reads = new Map<string, (snapshot: FileSnapshotResult) => void>()
const calls: string[] = []
const snapshot = (content = 'disk', revision = 'r1'): FileSnapshotResult => ({ status: 'success', content, revision })
const draft = (id: string, content = `${id} draft`): DraftDocument => ({ id, name: `${id}.md`, path: `/w/${id}.md`, content, diskRevision: 'r1' })
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
  vi.mocked(historyCall).mockResolvedValue([])
  vi.mocked(flushDraftProtection).mockResolvedValue(undefined)
  vi.mocked(bindRecoveredDraft).mockResolvedValue(undefined)
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
    if (op === 'recoveryDraftIndex') return (payload as { workspace: string }).workspace === '/w' ? drafts : []
    if (op === 'claimRecoveryDraft') {
      const { draft: item, claimId } = payload as { draft: DraftDescriptor; claimId: string }
      claimed.push(item.document.name)
      return { ...item, writer: `main:${claimId}`, content: `${item.document.name} recovered` }
    }
    throw new Error(`Unexpected operation ${op}`)
  })
  return claimed
}

describe('indexed draft recovery', () => {
  it('restores the latest owned draft after closing its folder, retaining its tab id and excluding other windows', async () => {
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
    await expect(closeWithDraftRecovery(cache, 'main', close)).rejects.toThrow('IPC reply lost')
    expect(close).not.toHaveBeenCalled()
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
