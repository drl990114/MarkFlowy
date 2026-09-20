import { enableMapSet } from 'immer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import useFileCacheStore, { getFileObject, getFileObjectByPath } from '@/helper/files'
import { createFile, updateFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
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
import { isDraftRecoveryPending, waitForDraftRecovery } from './draftRecoveryState'
import { bindRecoveredDraft, flushDraftProtection, historyCall, protectLocalEdit } from './local-history'
import { stageDraftRecovery } from './staged-draft-recovery'

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
  isUntouchedRecoveredDraft: () => true,
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
  const recovery = await stageDraftRecovery(options)
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
afterEach(async () => {
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

  it('restores every visible split before readiness, without changing the selected group', async () => {
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
    expect(ready).not.toHaveBeenCalled()
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
    const saved = JSON.parse(raw!) as DraftSession
    expect(saved.documents.map((doc) => doc.content)).toEqual(['new input', 'hidden draft'])
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
    const sessions = [...data.values()] as DraftSession[]
    expect(sessions.some((session) => session.documents.some((doc) => doc.content === 'latest input'))).toBe(true)
    expect(sessions.some((session) => session.documents.some((doc) => doc.content === 'hidden draft'))).toBe(true)
  })

  it('applies native then exit precedence before reads, preserving a divergent live edit', async () => {
    open('same')
    open('live', 'newer live input')
    useEditorStateStore.getState().setIdStateMap('live', { hasUnsavedChanges: true })
    vi.mocked(historyCall).mockImplementation(async (_op, payload) =>
      (payload as { workspace: string }).workspace === '/w' ? [{
        document: { id: 'native', name: 'same.md', path: '/w/same.md', workspace: '/w', generation: 1 },
        writer: 'main:old', sequence: 1, content: 'older native', diskRevision: 'r1', paused: true,
      }] : [])
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
