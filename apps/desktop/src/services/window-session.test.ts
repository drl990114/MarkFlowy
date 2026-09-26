import { enableMapSet } from 'immer'
import type { LazyStore } from '@tauri-apps/plugin-store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { updateFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { addExistingMarkdownFileEdit, ensureDocument } from './editor-file'
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
