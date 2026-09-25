import { enableMapSet } from 'immer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useFileCacheStore, { getFileObject, setFileObject } from '@/helper/files'
import { createFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { editorSnapshotRegistry } from '@/components/EditorArea/editorSnapshotRegistry'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { savePathCoordinator } from '@/components/EditorArea/savePathCoordinator'
import { readStableFileSnapshot } from '@/components/EditorArea/fileSnapshot'
import { markExternalFileConflict } from '@/components/EditorArea/externalFileChanges'
import {
  closeWithDraftRecovery,
  listenForDraftReload,
  type DraftDocument,
  type DraftSession,
  type DraftSessionStore,
} from './draft-recovery'
import { stageDraftRecovery } from './staged-draft-recovery'
import { RELOAD_DOCUMENT_PREFIX, RELOAD_SESSION_KEY, type DraftManifest } from './draftSessionFormat'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined), isTauri: () => false }))
vi.mock('zens', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/components/EditorArea/externalFileChanges', () => ({
  markExternalFileConflict: vi.fn(),
}))
vi.mock('@/components/EditorArea/fileSnapshot', () => ({ readStableFileSnapshot: vi.fn(), promoteOpeningRead: vi.fn() }))
vi.mock('@/startup/interactive', () => ({ afterStartupInteractive: (run: () => void) => { run(); return () => {} } }))

enableMapSet()
const cleanups: (() => void)[] = []
const resetEditors = () => {
  useFileCacheStore.setState({ entries: {}, pathEntries: {}, metadataRevision: 0 })
  useEditorStateStore.setState({ idStateMap: new Map() })
  useEditorStore.setState({
    folderData: [],
    opened: [],
    activeId: undefined,
    activeGroupId: 'group',
    editorLayout: { type: 'leaf', id: 'group', opened: [] },
  })
}
const open = (content: string, path?: string) => {
  const file = createFile({ name: 'Untitled.md', content, path })
  useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: true })
  useEditorStore.getState().addOpenedFile(file.id)
  useEditorStore.getState().setActiveId(file.id)
  return file
}
const createCache = () => {
  const data = new Map<string, unknown>()
  const save = vi.fn(async () => {})
  const cache: DraftSessionStore = {
    entries: async <T>() => [...data.entries()] as [string, T][],
    set: async (key, value) => {
      data.set(key, value)
    },
    delete: async (key) => data.delete(key),
    save,
  }
  const sessions = () =>
    [...data.entries()]
      .filter(([key]) => key.startsWith('draft-session:'))
      .map(([, value]) => value as DraftSession)
  return { cache, data, save, sessions }
}

// Exercise the production staged coordinator through both persistence sources.
const restoreDraftSession = async (cache: DraftSessionStore, signal?: AbortSignal) =>
  (await stageDraftRecovery({ cache, signal, onError: vi.fn() })).finished
const restoreDraftReloadSession = async (signal?: AbortSignal) =>
  (await stageDraftRecovery({ reload: true, signal, onError: vi.fn() })).finished
const restoreDraftDocuments = async (documents: DraftDocument[]) => {
  const { cache, data } = createCache()
  data.set('draft-session:test', { version: 1, documents })
  return restoreDraftSession(cache)
}

beforeEach(() => {
  vi.clearAllMocks()
  window.sessionStorage.clear()
  resetEditors()
})
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup())
})

describe('normal exit draft session', () => {
  it.each([false, true])(
    'restores unnamed documents without a workspace with autosave=%s',
    async (autosave) => {
      useAppSettingStore.setState((state) => ({ settingData: { ...state.settingData, autosave } }))
      const first = open('first draft')
      open('second draft')
      useEditorStore.getState().setActiveId(first.id)
      const { cache, sessions } = createCache()
      const close = vi.fn(async () => {})
      await closeWithDraftRecovery(cache, 'main', close)
      expect(close).toHaveBeenCalledOnce()
      expect(sessions()[0].documents.map((doc) => doc.content)).toEqual([
        'first draft',
        'second draft',
      ])
      expect(useEditorStateStore.getState().idStateMap.get(first.id)?.hasUnsavedChanges).toBe(true)
      resetEditors()
      expect(await restoreDraftSession(cache)).toBe(2)
      const state = useEditorStore.getState()
      expect(state.opened.map((id) => getFileObject(id).content)).toEqual([
        'first draft',
        'second draft',
      ])
      expect(getFileObject(state.activeId!).content).toBe('first draft')
      expect(
        state.opened.every(
          (id) =>
            !getFileObject(id).path &&
            useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges,
        ),
      ).toBe(true)
      expect(await restoreDraftSession(cache)).toBe(0)
    },
  )

  it('flushes the last deferred keystroke before the dirty check and the read-only barrier', async () => {
    const file = open('cached', '/w/a.md')
    fileSaveCoordinator.setDiskRevision(file.id, 'r1')
    useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: false })
    let pending = true
    cleanups.push(
      editorSnapshotRegistry.register(file.id, 'editor', {
        canRead: () => true,
        isVisible: () => true,
        hasPending: () => pending,
        onSyncDemandChanged: () => {},
        flush: () => {
          expect(savePathCoordinator.isFileReserved(file.id)).toBe(false)
          setFileObject(file.id, { ...file, content: 'latest DOM' })
          useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: true })
          pending = false
          return true
        },
      }),
    )
    const { cache, sessions } = createCache()
    await closeWithDraftRecovery(cache, 'main', async () => {})
    expect(sessions()[0].documents[0]).toMatchObject({ content: 'latest DOM', diskRevision: 'r1' })
  })

  it('waits for the cache write before closing and retains the snapshot through teardown', async () => {
    const file = open('keep me')
    const { cache, save, sessions } = createCache()
    let release!: () => void
    save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const close = vi.fn(async () => {
      resetEditors()
    })
    const closing = closeWithDraftRecovery(cache, 'main', close)
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(close).not.toHaveBeenCalled()
    expect(savePathCoordinator.isFileReserved(file.id)).toBe(true)
    release()
    await closing
    expect(close).toHaveBeenCalledOnce()
    expect(sessions()[0].documents[0].content).toBe('keep me')
    expect(savePathCoordinator.isFileReserved(file.id)).toBe(false)
  })

  it('keeps the window editable when the cache write fails and allows retry', async () => {
    const file = open('keep me')
    const { cache, save } = createCache()
    save.mockRejectedValueOnce(new Error('disk full'))
    const close = vi.fn(async () => {})
    await expect(closeWithDraftRecovery(cache, 'main', close)).rejects.toThrow('disk full')
    expect(close).not.toHaveBeenCalled()
    expect(savePathCoordinator.isFileReserved(file.id)).toBe(false)
    expect(getFileObject(file.id).content).toBe('keep me')
    await closeWithDraftRecovery(cache, 'main', close)
    expect(close).toHaveBeenCalledOnce()
  })

  it('does not close on an unfinished composition or an unavailable cache', async () => {
    const file = open('before')
    const { cache, save } = createCache()
    const close = vi.fn(async () => {})
    const unregister = editorSnapshotRegistry.register(file.id, 'editor', {
      canRead: () => false,
      isVisible: () => true,
      hasPending: () => false,
      onSyncDemandChanged: () => {},
      flush: () => true,
    })
    cleanups.push(unregister)
    await expect(closeWithDraftRecovery(cache, 'main', close)).rejects.toThrow('composing')
    expect(save).not.toHaveBeenCalled()
    unregister()
    await expect(closeWithDraftRecovery(undefined, 'main', close)).rejects.toThrow('not ready')
    expect(close).not.toHaveBeenCalled()
  })

  it('removes the exit snapshot if native close fails, preserving earlier unconsumed sessions', async () => {
    const { cache, data, sessions } = createCache()
    const previous: DraftSession = {
      version: 1,
      documents: [{ id: 'previous', name: 'previous.md', content: 'earlier draft' }],
    }
    data.set('draft-session:previous', previous)
    const file = open('current draft')
    await expect(
      closeWithDraftRecovery(cache, 'main', async () => {
        throw new Error('native close failed')
      }),
    ).rejects.toThrow('native close failed')
    expect(sessions()).toEqual([previous])
    expect(savePathCoordinator.isFileReserved(file.id)).toBe(false)
    await closeWithDraftRecovery(cache, 'main', async () => {})
    expect(sessions()).toHaveLength(2)
    expect(data.get('draft-session:previous')).toEqual(previous)
  })

  it('does not bring saved or explicitly discarded documents back on the next normal exit', async () => {
    const { cache, sessions } = createCache()
    open('old draft')
    await closeWithDraftRecovery(cache, 'main', async () => {})
    resetEditors()
    await restoreDraftSession(cache)
    const saved = useEditorStore.getState().activeId!
    setFileObject(saved, { ...getFileObject(saved), path: '/w/saved.md' })
    useEditorStateStore.getState().setIdStateMap(saved, { hasUnsavedChanges: false })
    const discarded = open('discard')
    useEditorStore.getState().delOpenedFile(discarded.id)
    await closeWithDraftRecovery(cache, 'main', async () => {})
    expect(sessions()[0].documents).toEqual([])
  })

  it('keeps other workspace sessions and existing layout data when windows exit', async () => {
    const { cache, data, sessions } = createCache()
    data.set('/one', { openedFilePaths: ['/one/a.md'] })
    for (const rootPath of ['/one', '/two']) {
      resetEditors()
      useEditorStore.setState({
        folderData: [{ id: rootPath, name: rootPath, kind: 'dir', path: rootPath }],
      })
      open(rootPath)
      await closeWithDraftRecovery(cache, 'main', async () => {})
    }
    expect(sessions()).toHaveLength(2)
    resetEditors()
    useEditorStore.setState({
      folderData: [{ id: '/one', name: 'one', kind: 'dir', path: '/one' }],
    })
    expect(await restoreDraftSession(cache)).toBe(1)
    expect(getFileObject(useEditorStore.getState().activeId!).content).toBe('/one')
    expect(sessions()[0].rootPath).toBe('/two')
    expect(data.get('/one')).toEqual({ openedFilePaths: ['/one/a.md'] })
  })

  it('retains unknown sessions and does not consume a cancelled recovery', async () => {
    const { cache, data, sessions } = createCache()
    data.set('draft-session:future', { version: 3, documents: [] })
    open('draft')
    await closeWithDraftRecovery(cache, 'main', async () => {})
    resetEditors()
    const controller = new AbortController()
    controller.abort()
    expect(await restoreDraftSession(cache, controller.signal)).toBe(0)
    expect(sessions()).toHaveLength(2)
    expect(useEditorStore.getState().opened).toEqual([])
    expect(await restoreDraftSession(cache)).toBe(1)
    expect(data.has('draft-session:future')).toBe(true)
  })
})

describe('WebView reload draft session', () => {
  const listen = (canSave = () => true) => {
    const onError = vi.fn()
    cleanups.push(listenForDraftReload({ canSave, onError }))
    return onError
  }
  const reload = (type = 'beforeunload') =>
    window.dispatchEvent(new Event(type, { cancelable: type === 'beforeunload' }))

  it.each(['second body', 'head'])('retains every previous body if writing the new %s fails', async (failure) => {
    const first = open('first previous')
    const second = open('second previous')
    const onError = listen()
    reload()
    const previous = window.sessionStorage.getItem(RELOAD_SESSION_KEY)
    const originalLength = window.sessionStorage.length
    setFileObject(first.id, { ...first, content: 'first newer' })
    setFileObject(second.id, { ...second, content: 'second newer' })
    const setItem = window.sessionStorage.setItem.bind(window.sessionStorage)
    let bodies = 0
    const denied = vi.spyOn(window.sessionStorage, 'setItem').mockImplementation((key, value) => {
      if (key.startsWith(RELOAD_DOCUMENT_PREFIX)) bodies++
      if (failure === 'head' ? key === RELOAD_SESSION_KEY : bodies === 2) throw new Error('quota')
      setItem(key, value)
    })
    expect(reload()).toBe(false)
    denied.mockRestore()
    expect(window.sessionStorage.getItem(RELOAD_SESSION_KEY)).toBe(previous)
    expect(window.sessionStorage.length).toBe(originalLength)
    expect(onError).toHaveBeenCalledOnce()
    resetEditors()
    expect(await restoreDraftReloadSession()).toBe(2)
    expect(useEditorStore.getState().opened.map((id) => getFileObject(id).content)).toEqual(['first previous', 'second previous'])
  })

  it('loads and validates only the selected reload body, retaining another corrupt body and the head', async () => {
    const first = open('good')
    open('bad')
    useEditorStore.getState().setActiveId(first.id)
    listen()
    reload()
    const raw = window.sessionStorage.getItem(RELOAD_SESSION_KEY)!
    const manifest = JSON.parse(raw) as DraftManifest
    const source = manifest.documents[1].source
    expect(source.kind).toBe('reload')
    if (source.kind !== 'reload') throw new Error('Expected reload body')
    window.sessionStorage.setItem(source.key, 'corrupt JSON')
    resetEditors()
    const controller = new AbortController()
    cleanups.push(() => controller.abort())
    const errors = vi.fn()
    const recovery = await stageDraftRecovery({ reload: true, signal: controller.signal, onError: errors })
    await recovery.visibleReady
    expect(getFileObject(useEditorStore.getState().activeId!).content).toBe('good')
    await recovery.finished
    expect(window.sessionStorage.getItem(RELOAD_SESSION_KEY)).toBe(raw)
    expect(window.sessionStorage.getItem(source.key)).toBe('corrupt JSON')
    expect(errors).toHaveBeenCalled()
  })

  it.each(['beforeunload', 'pagehide'])(
    'restores new unsaved documents after %s without waiting for native I/O',
    async (event) => {
      const first = open('第一份未保存文档')
      open('second draft')
      useEditorStore.getState().setActiveId(first.id)
      const onError = listen()
      expect(reload(event)).toBe(true)
      // Simulate a fresh renderer: only the browser session storage survives.
      resetEditors()
      expect(await restoreDraftReloadSession()).toBe(2)
      const state = useEditorStore.getState()
      expect(state.opened.map((id) => getFileObject(id).content)).toEqual([
        '第一份未保存文档',
        'second draft',
      ])
      expect(getFileObject(state.activeId!).content).toBe('第一份未保存文档')
      expect(
        state.opened.every(
          (id) => useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges,
        ),
      ).toBe(true)
      expect(await restoreDraftReloadSession()).toBe(0)
      expect(onError).not.toHaveBeenCalled()
    },
  )

  it('keeps an empty unnamed document while excluding the start-page tab', async () => {
    const file = open('')
    useEditorStateStore.getState().setIdStateMap(file.id, { hasUnsavedChanges: false })
    const tab = createFile({ name: 'New tab', kind: 'new_tab' })
    useEditorStore.getState().addOpenedFile(tab.id)
    listen()
    reload()
    resetEditors()
    expect(await restoreDraftReloadSession()).toBe(1)
    const restored = getFileObject(useEditorStore.getState().activeId!)
    expect(restored).toMatchObject({ content: '', name: file.name, kind: 'file' })
    expect(restored.path).toBeUndefined()
  })

  it('flushes deferred input synchronously and preserves revisions for existing files', async () => {
    const file = open('cached', '/w/a.md')
    fileSaveCoordinator.setDiskRevision(file.id, 'r1')
    let pending = true
    const unregister = editorSnapshotRegistry.register(file.id, 'editor', {
      canRead: () => true,
      isVisible: () => true,
      hasPending: () => pending,
      onSyncDemandChanged: () => {},
      flush: () => {
        setFileObject(file.id, { ...file, content: 'last keystroke' })
        pending = false
        return true
      },
    })
    cleanups.push(unregister)
    listen()
    reload()
    expect(pending).toBe(false)
    unregister()
    resetEditors()
    vi.mocked(readStableFileSnapshot).mockResolvedValue({
      status: 'success',
      content: 'disk',
      revision: 'r1',
    })
    expect(await restoreDraftReloadSession()).toBe(1)
    const id = useEditorStore.getState().activeId!
    expect(getFileObject(id).content).toBe('last keystroke')
    expect(fileSaveCoordinator.getDiskRevision(id)).toBe('r1')
  })

  it('retains the previous snapshot when reloading again before startup completes', async () => {
    let ready = true
    open('keep through startup')
    listen(() => ready)
    reload()
    resetEditors()
    ready = false
    reload()
    const controller = new AbortController()
    controller.abort()
    expect(await restoreDraftReloadSession(controller.signal)).toBe(0)
    expect(await restoreDraftReloadSession()).toBe(1)
    expect(getFileObject(useEditorStore.getState().activeId!).content).toBe('keep through startup')
  })

  it('preserves the latest text across repeated reloads and excludes saved or discarded drafts', async () => {
    const file = open('first')
    listen()
    reload()
    setFileObject(file.id, { ...file, content: 'latest' })
    reload()
    resetEditors()
    await restoreDraftReloadSession()
    const id = useEditorStore.getState().activeId!
    expect(getFileObject(id).content).toBe('latest')
    setFileObject(id, { ...getFileObject(id), path: '/w/saved.md' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    const discarded = open('discard me')
    reload()
    useEditorStore.getState().delOpenedFile(discarded.id)
    reload()
    resetEditors()
    expect(await restoreDraftReloadSession()).toBe(0)
  })

  it('blocks a reload on storage failure and retains the previous complete snapshot', async () => {
    const file = open('previous')
    const onError = listen()
    reload()
    setFileObject(file.id, { ...file, content: 'latest' })
    const denied = vi.spyOn(window.sessionStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota exceeded')
    })
    expect(reload()).toBe(false)
    expect(onError).toHaveBeenCalledOnce()
    denied.mockRestore()
    expect(getFileObject(file.id).content).toBe('latest')
    resetEditors()
    expect(await restoreDraftReloadSession()).toBe(1)
    expect(getFileObject(useEditorStore.getState().activeId!).content).toBe('previous')
  })

  it('leaves reload snapshots to startup when switching workspaces and removes disposed listeners', async () => {
    open('draft')
    const stop = listenForDraftReload({ canSave: () => true, onError: vi.fn() })
    cleanups.push(stop)
    reload()
    resetEditors()
    expect(await restoreDraftSession(createCache().cache)).toBe(0)
    expect(useEditorStore.getState().opened).toEqual([])
    stop()
    reload()
    expect(await restoreDraftReloadSession()).toBe(1)
  })
})

describe('restoring unsaved file content', () => {
  it('reuses a clean tab in its existing split group and preserves the active clean tab', async () => {
    const existing = createFile({ name: 'a.md', path: '/w/a.md' })
    const active = createFile({ name: 'b.md', path: '/w/b.md' })
    useEditorStore.getState().setEditorLayout(
      {
        type: 'branch',
        id: 'root',
        direction: 'horizontal',
        sizes: [50, 50],
        children: [
          { type: 'leaf', id: 'left', opened: [existing.id], activeId: existing.id },
          { type: 'leaf', id: 'right', opened: [active.id], activeId: active.id },
        ],
      },
      'right',
    )
    vi.mocked(readStableFileSnapshot).mockResolvedValue({
      status: 'success',
      content: 'disk',
      revision: 'r1',
    })
    const layout = useEditorStore.getState().editorLayout
    await restoreDraftDocuments([
      { id: 'stable', name: 'a.md', path: '/w/a.md', content: 'draft', diskRevision: 'r1' },
    ])
    expect(useEditorStore.getState().editorLayout).toBe(layout)
    expect(useEditorStore.getState().activeId).toBe(active.id)
    expect(getFileObject(existing.id).content).toBe('draft')
    expect(fileSaveCoordinator.getDiskRevision(existing.id)).toBe('r1')
    expect(markExternalFileConflict).not.toHaveBeenCalled()
  })

  it('preserves external disk changes through the existing conflict handling', async () => {
    vi.mocked(readStableFileSnapshot).mockResolvedValue({
      status: 'success',
      content: 'external',
      revision: 'r2',
    })
    await restoreDraftDocuments([
      { id: 'stable', name: 'a.md', path: '/w/a.md', content: 'draft', diskRevision: 'r1' },
    ])
    const id = useEditorStore.getState().activeId!
    expect(markExternalFileConflict).toHaveBeenCalledWith(id, 'r2')
    expect(getFileObject(id).content).toBe('draft')
    expect(fileSaveCoordinator.getDiskRevision(id)).toBe('r1')
  })

  it('recognizes a draft whose content is already saved to disk', async () => {
    vi.mocked(readStableFileSnapshot).mockResolvedValue({
      status: 'success',
      content: 'already saved',
      revision: 'r3',
    })
    await restoreDraftDocuments([
      { id: 'saved', name: 'a.md', path: '/w/a.md', content: 'already saved', diskRevision: 'r1' },
    ])
    const id = useEditorStore.getState().activeId!
    expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(false)
    expect(fileSaveCoordinator.getDiskRevision(id)).toBe('r3')
    expect(markExternalFileConflict).not.toHaveBeenCalled()
  })

  it('keeps deleted paths and competing dirty versions as separate saveable drafts', async () => {
    const existing = open('live edit', '/w/a.md')
    vi.mocked(readStableFileSnapshot).mockImplementation(async (path) => {
      if (path === '/w/missing.md') throw new Error('missing file')
      return { status: 'success', content: 'disk', revision: 'r1' }
    })
    await restoreDraftDocuments([
      { id: 'other', name: 'a.md', path: '/w/a.md', content: 'other edit' },
      { id: 'missing', name: 'missing.md', path: '/w/missing.md', content: 'rescued' },
    ])
    const files = useEditorStore.getState().opened.map((id) => getFileObject(id))
    expect(files.map((file) => file.content)).toEqual(['live edit', 'other edit', 'rescued'])
    expect(files.slice(1).every((file) => !file.path)).toBe(true)
    expect(getFileObject(existing.id).content).toBe('live edit')
  })
})
