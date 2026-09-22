import { act, cleanup, render, waitFor } from '@testing-library/react'
import { enableMapSet } from 'immer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as Rme from 'rme'
import type * as Zens from 'zens'
import { EVENT } from '@/constants'
import { EditorViewType } from '@/constants/editorViewType'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import bus from '@/helper/eventBus'
import { getFileObject, setFileObject } from '@/helper/files'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import TextEditor from './TextEditor'
import { getCapricornEditor } from './capricornEditorRegistry'
import { EXTERNAL_FILE_CONTENT_SYNC_EVENT } from './externalFileChanges'
import { sourceCodeCodemirrorViewMap } from './sourceCodeEditorRegistry'
import * as rmeRuntime from './rmeRuntime'

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  error: vi.fn(),
  rmeLoaded: vi.fn(),
  invoke: vi.fn(async () => ({ status: 'success', revision: 'disk:saved' })),
  editorStore: {
    clearEditorResources: vi.fn(),
    clearEditorDelegate: vi.fn(),
    clearEditorCtx: vi.fn(),
    setEditorDelegate: vi.fn(),
    setEditorCtx: vi.fn(),
    getEditorCtx: () => undefined,
    insertNodeToFolderData: vi.fn(),
  },
}))

vi.mock('@/commands', () => ({ commandRegistry: {
  execute: vi.fn(),
  registerCommand: () => ({ dispose: vi.fn() }),
} }))
vi.mock('@/AppThemeProvider', () => ({ AppEditorThemeProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/helper/clipboard', () => ({ clipboardRead: vi.fn() }))
vi.mock('@/helper/logger', () => ({ logger: { error: mocks.error } }))
vi.mock('@/helper/image', () => ({ getExportableImageSrc: vi.fn() }))
vi.mock('@/hooks/useKeyboard', () => {
  const state = { editorKeybingMap: {}, editorKeybindingsLoaded: false }
  return {
    useEditorKeybindingStore: Object.assign(
      (selector: (value: typeof state) => unknown) => selector(state),
      { getState: () => state },
    ),
  }
})
vi.mock('@/i18n', () => ({
  i18n: { dir: () => 'ltr', language: 'en', t: mocks.t, on: vi.fn(), off: vi.fn() },
  useTranslation: () => ({ t: mocks.t }),
}))
vi.mock('@/services/error-reporting', () => ({ captureException: mocks.error }))
vi.mock('@/stores', async () => ({
  useEditorStateStore: (await import('@/stores/useEditorStateStore')).default,
  useEditorStore: Object.assign((selector: (state: typeof mocks.editorStore) => unknown) => selector(mocks.editorStore), {
    getState: () => mocks.editorStore,
  }),
}))
vi.mock('@/stores/useAppSettingStore', () => {
  const state = { settingData: { autosave: false, autosave_interval: 1000, editor_root_font_size: 16, editor_root_line_height: '1.7' } }
  return { default: Object.assign((selector: (value: typeof state) => unknown) => selector(state), { getState: () => state }) }
})
vi.mock('@/stores/useThemeStore', () => ({ default: (selector: (value: { curTheme: { mode: string } }) => unknown) => selector({ curTheme: { mode: 'light' } }) }))
vi.mock('./createWysiwygDelegateOptions', () => ({
  createWysiwygDelegateOptions: () => ({}),
  getCurrentEditorInsertDateFormat: vi.fn(),
  normalizeLivePreviewBlockBehavior: () => 'source',
}))
vi.mock('./fileSnapshot', () => ({ readStableFileSnapshot: async () => ({ status: 'success', content: '# Opened file\n\nBody\n', revision: 'disk:A' }) }))
vi.mock('./openEditorLink', () => ({ openEditorLink: vi.fn() }))
vi.mock('./pdf-print/PdfPrintController', () => ({ PdfPrintController: () => null }))
vi.mock('./pandoc-export/PandocExportController', () => ({ PandocExportController: () => null }))
vi.mock('zens', async (importOriginal) => ({
  ...(await importOriginal<typeof Zens>()),
  toast: { error: mocks.error },
}))
vi.mock('rme', async (importOriginal) => {
  mocks.rmeLoaded()
  return importOriginal<typeof Rme>()
})
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }))
vi.mock('@/services/local-history', () => ({
  releaseClosedFileContent: vi.fn(async () => true),
  observeHistoryFile: vi.fn(async () => {}),
  endHistoryBatch: vi.fn(),
  protectLocalEdit: vi.fn(async () => {}),
  historyFileSaved: vi.fn(),
  isHistoryAutosavePaused: () => false,
}))

enableMapSet()
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe.skipIf(!isCapricornRuntimeAvailable)('TextEditor opening', () => {
  it('retains the selected preview mode when a document gains another editor instance', async () => {
    const id = 'opening-preview'
    setFileObject(id, { id, name: 'preview.md', path: '/synthetic/preview.md', kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    useEditorViewTypeStore.getState().setEditorViewType(id, EditorViewType.PREVIEW)
    render(<TextEditor active id={id} groupId='preview-group' fileTypeConfig={{
      type: 'markdown', defaultMode: EditorViewType.WYSIWYG,
      supportedModes: [EditorViewType.WYSIWYG, EditorViewType.PREVIEW],
    }} />)
    await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
    expect(mocks.rmeLoaded).not.toHaveBeenCalled()
    expect(useEditorViewTypeStore.getState().editorViewTypeMap.get(id)).toBe(EditorViewType.PREVIEW)
    expect(getCapricornEditor(id)?.getUiState().readOnly).toBe(true)
  })

  it('keeps a loaded file clean until its first actual edit', async () => {
    const id = 'opening-file'
    setFileObject(id, { id, name: 'opening.md', path: '/synthetic/opening.md', kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    render(<TextEditor active id={id} groupId='group' fileTypeConfig={{
      type: 'markdown', defaultMode: EditorViewType.WYSIWYG,
      supportedModes: [EditorViewType.WYSIWYG],
    }} />)
    await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
    expect(mocks.rmeLoaded).not.toHaveBeenCalled()
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 100)))
    expect(mocks.error).not.toHaveBeenCalled()
    expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(false)
    await act(async () => getCapricornEditor(id)?.commands.insertLink?.({ href: 'https://example.com', text: 'Link' }))
    expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(true)
  })

  it('loads source on demand with the latest Markdown and saves real source edits before preview', async () => {
    const runtime = await rmeRuntime.loadRmeRuntime()
    let resolve!: (value: typeof runtime) => void
    vi.spyOn(rmeRuntime, 'getLoadedRmeRuntime').mockReturnValue(undefined)
    vi.spyOn(rmeRuntime, 'loadRmeRuntime').mockReturnValue(new Promise((done) => { resolve = done }))
    const id = 'opening-deferred-source'
    setFileObject(id, { id, name: 'modes.md', path: '/synthetic/modes.md', kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    const save = vi.fn()
    bus.on(EVENT.app_save, save)
    try {
      render(<TextEditor active id={id} fileTypeConfig={{
        type: 'markdown', defaultMode: EditorViewType.WYSIWYG,
        supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE, EditorViewType.PREVIEW],
      }} />)
      await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
      await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.SOURCECODE))
      await waitFor(() => expect(useEditorViewTypeStore.getState().getEditorViewType(id)).toBe(EditorViewType.SOURCECODE))
      expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()
      const latest = '# Latest content\n\nArrived during loading.\n'
      await act(async () => bus.emit(EXTERNAL_FILE_CONTENT_SYNC_EVENT, undefined, { fileId: id, content: latest }))
      await act(async () => resolve(runtime))
      await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)?.cm.state.doc.toString()).toBe(latest))
      const source = sourceCodeCodemirrorViewMap.get(id)!
      const edited = '# Edited in source\n\nSaved before switching.\n'
      await act(async () => source.cm.dispatch({ changes: { from: 0, to: source.cm.state.doc.length, insert: edited } }))
      expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(true)
      await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.PREVIEW))
      await waitFor(() => expect(useEditorViewTypeStore.getState().getEditorViewType(id)).toBe(EditorViewType.PREVIEW))
      await waitFor(() => expect(getCapricornEditor(id)?.getMarkdown()).toBe(edited))
      expect(save).toHaveBeenCalledTimes(2)
      expect(getFileObject(id)?.content).toBe(edited)
      expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(false)
    } finally {
      bus.detach(EVENT.app_save, save)
    }
  })
})
