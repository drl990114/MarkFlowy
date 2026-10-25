import { enableMapSet } from 'immer'
import { invoke } from '@tauri-apps/api/core'
import type { LazyStore } from '@tauri-apps/plugin-store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { updateFile } from '@/helper/filesys'
import useEditorStore, { type EditorLayoutNode } from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { addExistingMarkdownFileEdit, addNewMarkdownFileEdit, ensureDocument } from './editor-file'
import { captureProtectedDraftSession } from './draft-recovery'
import { stageDraftRecovery } from './staged-draft-recovery'
import {
  createWindowSessionPersistence,
  LAST_WINDOW_SESSION_KEY,
  readWindowSession,
  restoreWindowDocuments,
  windowSessionKey,
  type WindowSession,
} from './window-session'
import { isSingleDocumentLayout } from '@/components/EditorArea/documentLayout'
import { EditorViewType } from '@/constants/editorViewType'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => false }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/i18n', () => ({ i18n: { t: () => 'Untitled' }, t: (key: string) => key }))
vi.mock('@/startup/interactive', () => ({
  afterStartupInteractive: (callback: () => void) => {
    queueMicrotask(callback)
    return () => {}
  },
}))
enableMapSet()

const resetEditor = () => {
  useEditorStore.getState().setFolderData(null)
  useFileCacheStore.setState({
    entries: {},
    contentEntries: {},
    pathEntries: {},
    metadataRevision: 0,
  })
  useEditorStateStore.setState({ idStateMap: new Map() })
}
const cleanups: (() => Promise<void>)[] = []
beforeEach(() => {
  vi.mocked(invoke).mockReset()
  resetEditor()
  sessionStorage.clear()
})
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()))
  vi.useRealTimers()
  vi.restoreAllMocks()
})
const disk = () => {
  const data = new Map<string, unknown>()
  const store: Pick<LazyStore, 'get' | 'set' | 'save'> = {
    get: async <T>(key: string) => data.get(key) as T | undefined,
    set: async (key, value) => {
      data.set(key, structuredClone(value))
    },
    save: async () => {},
  }
  return { data, store }
}

describe('document-first sessions', () => {
  it('creates one editable but clean starter and excludes it from draft recovery', async () => {
    ensureDocument()
    ensureDocument()
    const state = useEditorStore.getState()
    expect(state.opened).toHaveLength(1)
    expect(getFileObject(state.activeId!)).toMatchObject({
      kind: 'file',
      ext: 'md',
      content: '',
      path: undefined,
    })
    expect(useEditorStateStore.getState().idStateMap.get(state.activeId!)?.hasUnsavedChanges).toBe(
      false,
    )
    expect((await captureProtectedDraftSession()).documents).toEqual([])
    expect(isSingleDocumentLayout(undefined, state.editorLayout)).toBe(true)
  })

  it('replaces only the untouched starter and deduplicates an already-open path', async () => {
    ensureDocument()
    const starter = useEditorStore.getState().activeId
    await addExistingMarkdownFileEdit({ fileName: 'first.md', path: '/first.md' })
    expect(useEditorStore.getState().opened).toHaveLength(1)
    expect(useEditorStore.getState().opened).not.toContain(starter)
    await addExistingMarkdownFileEdit({ fileName: 'first.md', path: '/first.md' })
    expect(useEditorStore.getState().opened).toHaveLength(1)
    await addExistingMarkdownFileEdit({ fileName: 'second.md', path: '/second.md' })
    expect(isSingleDocumentLayout(undefined, useEditorStore.getState().editorLayout)).toBe(false)
    expect(useEditorStore.getState().getRootPath()).toBeUndefined()
  })

  it('keeps the starter editable even when existing Markdown files default to preview', () => {
    const settings = useAppSettingStore.getState().settingData
    useAppSettingStore.setState({
      settingData: { ...settings, md_editor_default_mode: EditorViewType.PREVIEW },
    })
    try {
      ensureDocument()
      const id = useEditorStore.getState().activeId!
      expect(useEditorViewTypeStore.getState().editorViewTypeMap.get(id)).not.toBe(
        EditorViewType.PREVIEW,
      )
    } finally {
      useAppSettingStore.setState({ settingData: settings })
    }
  })

  it('retains a starter once edited, including after undoing back to empty text', async () => {
    ensureDocument()
    const id = useEditorStore.getState().activeId!
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: true })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    await addExistingMarkdownFileEdit({ fileName: 'other.md', path: '/other.md' })
    expect(useEditorStore.getState().opened).toContain(id)
    expect((await captureProtectedDraftSession()).documents.map((doc) => doc.id)).toEqual([id])
  })

  it('restores saved documents and an untitled draft into their original split groups', async () => {
    const { store } = disk()
    ensureDocument()
    const draftId = useEditorStore.getState().activeId!
    updateFile({ id: draftId, content: 'keep my draft' })
    useEditorStateStore.getState().setIdStateMap(draftId, { hasUnsavedChanges: true })
    await addExistingMarkdownFileEdit({ fileName: 'saved.md', path: '/saved.md' })
    const savedId = useEditorStore.getState().activeId!
    useEditorStore.getState().setEditorLayout(
      {
        type: 'branch',
        id: 'split',
        direction: 'horizontal',
        sizes: [30, 70],
        children: [
          { type: 'leaf', id: 'left', opened: [savedId], activeId: savedId },
          { type: 'leaf', id: 'right', opened: [draftId], activeId: draftId },
        ],
      },
      'right',
    )
    const layout = useEditorStore.getState().editorLayout
    const persistence = createWindowSessionPersistence(store, 'main')
    cleanups.push(persistence.dispose)
    await persistence.flush()
    const session = await readWindowSession(store, 'main')
    expect(session?.rootPath).toBeUndefined()
    await persistence.dispose()
    resetEditor()
    restoreWindowDocuments(session!)
    const onError = vi.fn()
    const recovery = await stageDraftRecovery({ session, onError })
    await recovery.finished
    expect(onError).not.toHaveBeenCalled()
    expect(useEditorStore.getState().editorLayout).toEqual(layout)
    expect(useEditorStore.getState().activeId).toBe(draftId)
    expect(getFileObject(draftId).content).toBe('keep my draft')
    expect(getFileObject(savedId).path).toBe('/saved.md')
  })

  it('isolates window snapshots and restores the last active window on a cold launch', async () => {
    const { store, data } = disk()
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    await addExistingMarkdownFileEdit({ fileName: 'one.md', path: '/one.md' })
    const first = createWindowSessionPersistence(store, 'main')
    cleanups.push(first.dispose)
    await first.flush()
    await first.dispose()
    resetEditor()
    vi.mocked(document.hasFocus).mockReturnValue(false)
    await addExistingMarkdownFileEdit({ fileName: 'two.md', path: '/two.md' })
    const second = createWindowSessionPersistence(store, 'main_second')
    cleanups.push(second.dispose)
    await second.flush()
    await second.dispose()
    expect((data.get(windowSessionKey('main')) as WindowSession).files[0].path).toBe('/one.md')
    expect((await readWindowSession(store, 'main_second'))?.files[0].path).toBe('/two.md')
    sessionStorage.clear()
    expect((await readWindowSession(store, 'main'))?.files[0].path).toBe('/one.md')
    expect(await readWindowSession(store, 'main_new')).toBeUndefined()
    await store.set(LAST_WINDOW_SESSION_KEY, windowSessionKey('main_second'))
    expect((await readWindowSession(store, 'main'))?.files[0].path).toBe('/two.md')
  })

  it('restores workspace and independent document windows with their own split, selection and drafts', async () => {
    const { store } = disk()
    vi.mocked(invoke).mockImplementation(async (command) =>
      command === 'get_file_snapshot'
        ? { status: 'success', content: 'saved disk text', revision: 'disk-before-edit' }
        : undefined,
    )
    const snapshots: {
      label: string
      rootPath?: string
      path?: string
      fileId?: string
      draftId: string
      layout: EditorLayoutNode
      activeGroupId: string
      activeId: string
    }[] = []
    for (const { label, rootPath, path, activePane } of [
      { label: 'main', rootPath: '/workspace', path: '/workspace/note.md', activePane: 'file' },
      { label: 'main_file', path: '/standalone/note.md', activePane: 'draft' },
      { label: 'main_untitled', activePane: 'draft' },
    ]) {
      resetEditor()
      sessionStorage.clear()
      if (rootPath) {
        useEditorStore.getState().setFolderDataPure([
          { id: 'workspace', name: 'workspace', path: rootPath, kind: 'dir' },
        ])
      }
      await addNewMarkdownFileEdit({
        fileName: 'Untitled.md', content: `${label}: unsaved untitled text`,
      })
      const draftId = useEditorStore.getState().activeId!
      let fileId: string | undefined
      if (path) {
        await addExistingMarkdownFileEdit({ fileName: 'note.md', path })
        fileId = useEditorStore.getState().activeId!
        updateFile({ id: fileId, content: `${label}: edited file text` })
        useEditorStateStore.getState().setIdStateMap(fileId, { hasUnsavedChanges: true })
      }
      const draftPane: EditorLayoutNode = {
        type: 'leaf', id: `${label}-draft`, opened: [draftId], activeId: draftId,
      }
      const layout: EditorLayoutNode = fileId ? {
        type: 'branch', id: `${label}-split`,
        direction: rootPath ? 'horizontal' : 'vertical', sizes: rootPath ? [35, 65] : [70, 30],
        children: [
          { type: 'leaf', id: `${label}-file`, opened: [fileId], activeId: fileId },
          draftPane,
        ],
      } : draftPane
      const activeGroupId = `${label}-${activePane}`
      const activeId = activePane === 'file' ? fileId! : draftId
      useEditorStore.getState().setEditorLayout(
        layout.type === 'branch' ? { ...layout, sizes: [50, 50] } : layout,
        activeGroupId,
      )
      const persistence = createWindowSessionPersistence(store, label)
      cleanups.push(persistence.dispose)
      if (layout.type === 'branch') {
        useEditorStore.getState().setBranchSizes(layout.id, layout.sizes)
        expect(useEditorStore.getState().editorLayout).toEqual(layout)
      }
      await persistence.flush()
      await persistence.dispose()
      snapshots.push({ label, rootPath, path, fileId, draftId, layout, activeGroupId, activeId })
    }
    // The focused-window pointer must not select the same session for all windows.
    await store.set(LAST_WINDOW_SESSION_KEY, windowSessionKey('main_untitled'))
    for (const expected of snapshots) {
      resetEditor()
      sessionStorage.clear()
      const session = await readWindowSession(store, expected.label, expected.label)
      expect(session?.rootPath).toBe(expected.rootPath)
      if (session?.rootPath) {
        useEditorStore.getState().setFolderDataPure([
          { id: 'restored-root', name: 'workspace', path: session.rootPath, kind: 'dir' },
        ])
      }
      restoreWindowDocuments(session!)
      const onError = vi.fn()
      const recovery = await stageDraftRecovery({ session, onError })
      expect(await recovery.finished).toBe(expected.fileId ? 2 : 1)
      expect(onError).not.toHaveBeenCalled()
      const editor = useEditorStore.getState()
      expect(editor.getRootPath()).toBe(expected.rootPath)
      expect(editor.editorLayout).toEqual(expected.layout)
      expect(editor.activeGroupId).toBe(expected.activeGroupId)
      expect(editor.activeId).toBe(expected.activeId)
      expect(editor.opened).toEqual(
        expected.fileId ? [expected.fileId, expected.draftId] : [expected.draftId],
      )
      expect(getFileObject(expected.draftId)).toMatchObject({
        path: undefined, content: `${expected.label}: unsaved untitled text`,
      })
      if (expected.fileId) {
        expect(getFileObject(expected.fileId)).toMatchObject({
          path: expected.path, content: `${expected.label}: edited file text`,
        })
      }
      for (const id of editor.opened) {
        expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(true)
      }
      for (const foreign of snapshots.filter(({ label }) => label !== expected.label)) {
        expect(getFileObject(foreign.draftId)).toBeUndefined()
        if (foreign.fileId) expect(getFileObject(foreign.fileId)).toBeUndefined()
      }
    }
  })

  it('uses an explicit snapshot label even when main and the last-active pointer name other sessions', async () => {
    const { store } = disk()
    for (const [label, path] of [['main', '/main.md'], ['main_other', '/other.md']]) {
      resetEditor()
      await addExistingMarkdownFileEdit({ fileName: path.slice(1), path })
      const persistence = createWindowSessionPersistence(store, label)
      cleanups.push(persistence.dispose)
      await persistence.flush()
      await persistence.dispose()
    }
    await store.set(LAST_WINDOW_SESSION_KEY, windowSessionKey('main_other'))
    for (const currentLabel of ['main', 'main_recreated']) {
      resetEditor()
      sessionStorage.clear()
      const session = await readWindowSession(store, currentLabel, 'main')
      restoreWindowDocuments(session!)
      const state = useEditorStore.getState()
      expect(state.opened).toHaveLength(1)
      expect(getFileObject(state.activeId!)).toMatchObject({ path: '/main.md', name: 'main.md' })
    }
    sessionStorage.clear()
    expect(await readWindowSession(store, 'main', 'missing-window')).toBeUndefined()
  })

  it('starts an explicitly fresh main window without reviving its old documents or last-active snapshot', async () => {
    const { store } = disk()
    ensureDocument()
    const oldId = useEditorStore.getState().activeId!
    updateFile({ id: oldId, content: 'old unsaved draft' })
    useEditorStateStore.getState().setIdStateMap(oldId, { hasUnsavedChanges: true })
    const persistence = createWindowSessionPersistence(store, 'main')
    cleanups.push(persistence.dispose)
    await persistence.flush()
    await persistence.dispose()
    resetEditor()
    sessionStorage.clear()
    expect(await readWindowSession(store, 'main', null)).toBeUndefined()
    ensureDocument()
    const state = useEditorStore.getState()
    expect(state.opened).toHaveLength(1)
    expect(state.activeId).not.toBe(oldId)
    expect(getFileObject(state.activeId!)).toMatchObject({ path: undefined, content: '' })
    expect((await captureProtectedDraftSession()).documents).toEqual([])
    // An explicit fresh window does not erase the preserved session for another launch.
    expect((await readWindowSession(store, 'main', 'main'))?.files.map(({ id }) => id)).toEqual([oldId])
  })

  it('reloads its own latest draft even when native bootstrap still marks the window fresh', async () => {
    const { store } = disk()
    ensureDocument()
    const id = useEditorStore.getState().activeId!
    updateFile({ id, content: 'first persisted draft' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: true })
    const persistence = createWindowSessionPersistence(store, 'main_fresh')
    cleanups.push(persistence.dispose)
    await persistence.flush()
    updateFile({ id, content: 'latest edit before WebView reload' })
    await persistence.flush()
    await persistence.dispose()
    resetEditor()
    // Keep sessionStorage, as a reload does; a cold launch clears it in the tests above.
    const session = await readWindowSession(store, 'main_fresh', null)
    restoreWindowDocuments(session!)
    const onError = vi.fn()
    const recovery = await stageDraftRecovery({ session, onError })
    expect(await recovery.finished).toBe(1)
    expect(onError).not.toHaveBeenCalled()
    expect(useEditorStore.getState().opened).toEqual([id])
    expect(useEditorStore.getState().activeId).toBe(id)
    expect(getFileObject(id).content).toBe('latest edit before WebView reload')
    expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(true)
  })

  it('keeps an explicit empty document session so old workspace history does not win', async () => {
    const { store } = disk()
    ensureDocument()
    const persistence = createWindowSessionPersistence(store, 'main')
    cleanups.push(persistence.dispose)
    await persistence.flush()
    const session = await readWindowSession(store, 'main')
    expect(session).toMatchObject({ rootPath: undefined, files: [], drafts: { documents: [] } })
  })

  it('persists a closed folder without needing a tab change or a window close', async () => {
    vi.useFakeTimers()
    const { store, data } = disk()
    useEditorStore.getState().setFolderDataPure([{ id: 'folder', name: 'notes', path: '/notes', kind: 'dir' }])
    await addExistingMarkdownFileEdit({ fileName: 'saved.md', path: '/notes/saved.md' })
    const persistence = createWindowSessionPersistence(store, 'main')
    cleanups.push(persistence.dispose)
    await persistence.flush()
    expect((data.get(windowSessionKey('main')) as WindowSession).rootPath).toBe('/notes')
    const layout = useEditorStore.getState().editorLayout
    useEditorStore.getState().setFolderDataPure(null)
    await vi.advanceTimersByTimeAsync(801)
    expect(useEditorStore.getState().editorLayout).toBe(layout)
    expect((data.get(windowSessionKey('main')) as WindowSession).rootPath).toBeUndefined()
    expect((data.get(windowSessionKey('main')) as WindowSession).files[0].path).toBe('/notes/saved.md')
  })
})
