// @vitest-environment jsdom
import { EditorView } from '@codemirror/view'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { enableMapSet } from 'immer'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type * as Rme from 'rme'
import type * as Zens from 'zens'
import { EVENT } from '@/constants'
import { EditorViewType } from '@/constants/editorViewType'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import bus from '@/helper/eventBus'
import { getFileObject, setFileObject } from '@/helper/files'
import { createEditorResumeStore } from '@/stores/editorResumeStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import TextEditor from './TextEditor'
import { getCapricornEditor } from './capricornEditorRegistry'
import { getCapricornRuntimeInput } from './capricornRuntimeDom'
import { EXTERNAL_FILE_CONTENT_SYNC_EVENT } from './externalFileChanges'
import { sourceCodeCodemirrorViewMap } from './sourceCodeEditorRegistry'
import * as rmeRuntime from './rmeRuntime'
import * as capricornRuntime from './capricornRuntimeAdapter'
import { endHistoryBatch } from '@/services/local-history'

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  error: vi.fn(),
  rmeLoaded: vi.fn(),
  invoke: vi.fn(async (command: string) =>
    command === 'get_snippets'
      ? { version: 1, revision: 0, items: [], hiddenBuiltinIds: [] }
      : { status: 'success', revision: 'disk:saved' },
  ),
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
beforeAll(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => document.createElement('div').getBoundingClientRect(),
  })
})
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

})

describe.skipIf(!isCapricornRuntimeAvailable)('TextEditor source mode transitions', () => {
  // Keep the opening suite cold, then prepare the real source-editor fixture
  // outside the behavior tests' 5s deadline. CI module transforms can be slow.
  beforeAll(async () => {
    await rmeRuntime.loadRmeRuntime()
  }, 30_000)

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
      const loading = vi.fn()
      const { container } = render(<TextEditor onLoadingChange={loading} active id={id} fileTypeConfig={{
        type: 'markdown', defaultMode: EditorViewType.WYSIWYG,
        supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE, EditorViewType.PREVIEW],
      }} />)
      await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
      const originalEditor = getCapricornEditor(id)
      const originalBody = container.querySelector('[data-cap-content]')
      await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.SOURCECODE))
      expect(useEditorViewTypeStore.getState().getEditorViewType(id)).toBe(EditorViewType.WYSIWYG)
      expect(getCapricornEditor(id)).toBe(originalEditor)
      expect(container.querySelector('[data-cap-content]')).toBe(originalBody)
      expect(container.textContent).not.toContain('document_preview.loading')
      expect(loading).toHaveBeenLastCalledWith(true)
      expect(save).not.toHaveBeenCalled()
      expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()
      const latest = '# Latest content\n\nArrived during loading.\n'
      await act(async () => bus.emit(EXTERNAL_FILE_CONTENT_SYNC_EVENT, undefined, { fileId: id, content: latest }))
      // Remote callbacks are suppressed until the next task; resume local input
      // after that boundary while the source runtime is still unresolved.
      await act(async () => new Promise<void>((done) => window.setTimeout(done, 0)))
      expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()
      await act(async () => originalEditor?.commands.insertLink?.({ href: 'https://example.com', text: 'Typed while loading' }))
      const latestEdited = originalEditor!.getMarkdown()
      expect(latestEdited).toContain('Typed while loading')
      await act(async () => resolve(runtime))
      await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)?.cm.state.doc.toString()).toBe(latestEdited))
      expect(loading).toHaveBeenLastCalledWith(false)
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

  it('cancels the switch when the current mode is selected during its save', async () => {
    await rmeRuntime.loadRmeRuntime()
    const id = 'opening-canceled-save'
    setFileObject(id, { id, name: 'cancel.md', path: '/synthetic/cancel.md', kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    const { container } = render(<TextEditor active id={id} fileTypeConfig={{
      type: 'markdown', defaultMode: EditorViewType.WYSIWYG,
      supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE],
    }} />)
    await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
    const originalEditor = getCapricornEditor(id)
    const body = container.querySelector('[data-cap-content]')
    let finishSave!: () => void
    const save = new Promise<void>((resolve) => { finishSave = resolve })
    vi.mocked(endHistoryBatch).mockReturnValueOnce(save)
    await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.SOURCECODE))
    await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.WYSIWYG))
    await act(async () => finishSave())
    expect(getCapricornEditor(id)).toBe(originalEditor)
    expect(container.querySelector('[data-cap-content]')).toBe(body)
    expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()
    expect(useEditorViewTypeStore.getState().getEditorViewType(id)).toBe(EditorViewType.WYSIWYG)
  })

  it('keeps focus on the same content selection across modes instead of restoring stale mode positions', async () => {
    await rmeRuntime.loadRmeRuntime()
    const id = 'opening-mode-focus'
    setFileObject(id, { id, name: 'focus.md', path: '/synthetic/focus.md', kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    createEditorResumeStore('/synthetic/focus.md', 'focus-group', 'edit').getState().save({
      scrollTop: 0,
      scrollLeft: 0,
      selection: {
        kind: 'capricorn',
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 0], offset: 1 },
      },
    })
    const { container } = render(<TextEditor active id={id} groupId='focus-group' fileTypeConfig={{
      type: 'markdown', defaultMode: EditorViewType.SOURCECODE,
      supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE],
    }} />)
    await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)).toBeDefined())
    const sourceSelection = { anchor: 11, head: 4 }
    const visualSelection = {
      kind: 'capricorn' as const,
      anchor: { path: [0, 0], offset: 9 },
      focus: { path: [0, 0], offset: 2 },
    }
    const movedVisualSelection = {
      kind: 'capricorn' as const,
      anchor: { path: [1, 0], offset: 3 },
      focus: { path: [1, 0], offset: 1 },
    }
    // '# Opened file\n\n' occupies 15 source characters before the body.
    const movedSourceSelection = { anchor: 18, head: 16 }
    await act(async () => {
      const source = sourceCodeCodemirrorViewMap.get(id)!.cm
      source.focus()
      source.dispatch({ selection: sourceSelection })
    })
    expect(sourceCodeCodemirrorViewMap.get(id)!.cm.state.selection.main).toMatchObject(sourceSelection)

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.WYSIWYG))
      await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
      const visual = getCapricornEditor(id)!
      await waitFor(() => expect(document.activeElement).toBe(getCapricornRuntimeInput(container)))
      await waitFor(() => expect(visual.resume!.capture()).toEqual(
        cycle === 0 ? visualSelection : movedVisualSelection,
      ))
      if (cycle === 0) {
        await act(async () => expect(visual.resume!.restore(movedVisualSelection)).toBe(true))
      }
      await waitFor(() => expect(visual.resume!.capture()).toEqual(movedVisualSelection))

      await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.SOURCECODE))
      await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)).toBeDefined())
      const source = sourceCodeCodemirrorViewMap.get(id)!.cm
      await waitFor(() => expect(source.state.selection.main).toMatchObject(movedSourceSelection))
      await waitFor(() => expect(source.hasFocus).toBe(true))
      expect(document.activeElement).toBe(source.contentDOM)
      expect(source.state.selection.main).toMatchObject(movedSourceSelection)
    }
  })

  it('does not reclaim focus from another input after deferred source preparation', async () => {
    const runtime = await rmeRuntime.loadRmeRuntime()
    let resolve!: (value: typeof runtime) => void
    vi.spyOn(rmeRuntime, 'getLoadedRmeRuntime').mockReturnValue(undefined)
    vi.spyOn(rmeRuntime, 'loadRmeRuntime').mockReturnValue(new Promise((done) => { resolve = done }))
    const id = 'opening-source-focus-moved'
    setFileObject(id, { id, name: 'focus-moved.md', path: '/synthetic/focus-moved.md', kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    const { container } = render(<TextEditor active id={id} fileTypeConfig={{
      type: 'markdown', defaultMode: EditorViewType.WYSIWYG,
      supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE],
    }} />)
    await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
    await act(async () => getCapricornEditor(id)!.focus())
    await waitFor(() => expect(document.activeElement).toBe(getCapricornRuntimeInput(container)))
    await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.SOURCECODE))
    expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()

    const outsideInput = document.createElement('input')
    document.body.append(outsideInput)
    try {
      outsideInput.focus()
      await act(async () => resolve(runtime))
      await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)).toBeDefined())
      // Allow the selection-resume and any queued focus frames to settle.
      await act(async () => new Promise<void>((done) => {
        requestAnimationFrame(() => requestAnimationFrame(() => done()))
      }))
      expect(document.activeElement).toBe(outsideInput)
      expect(sourceCodeCodemirrorViewMap.get(id)!.cm.hasFocus).toBe(false)
    } finally {
      outsideInput.remove()
    }
  })

  it('does not reclaim focus from another input after deferred visual preparation', async () => {
    const factory = await capricornRuntime.loadCapricornRuntimeFactory()
    let resolve!: (value: typeof factory) => void
    vi.spyOn(capricornRuntime, 'getLoadedCapricornRuntimeFactory').mockReturnValue(undefined)
    vi.spyOn(capricornRuntime, 'loadCapricornRuntimeFactory').mockReturnValue(new Promise((done) => { resolve = done }))
    const id = 'opening-visual-focus-moved'
    setFileObject(id, { id, name: 'visual-focus.md', path: '/synthetic/visual-focus.md', kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    const { container } = render(<TextEditor active id={id} fileTypeConfig={{
      type: 'markdown', defaultMode: EditorViewType.SOURCECODE,
      supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE],
    }} />)
    await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)).toBeDefined())
    await act(async () => {
      const source = sourceCodeCodemirrorViewMap.get(id)!.cm
      source.focus()
      source.dispatch({ selection: { anchor: 11, head: 4 } })
    })
    await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.WYSIWYG))
    expect(getCapricornEditor(id)).toBeUndefined()

    const outsideInput = document.createElement('input')
    document.body.append(outsideInput)
    try {
      outsideInput.focus()
      await act(async () => resolve(factory))
      await waitFor(() => expect(getCapricornEditor(id)?.resume?.capture()).toEqual({
        kind: 'capricorn',
        anchor: { path: [0, 0], offset: 9 },
        focus: { path: [0, 0], offset: 2 },
      }))
      await act(async () => new Promise<void>((done) => {
        requestAnimationFrame(() => requestAnimationFrame(() => done()))
      }))
      expect(document.activeElement).toBe(outsideInput)
      expect(document.activeElement).not.toBe(getCapricornRuntimeInput(container))
    } finally {
      outsideInput.remove()
    }
  })

  it('transfers a directional selection into a real embedded code editor and back to source', async () => {
    await rmeRuntime.loadRmeRuntime()
    const id = 'opening-code-focus'
    const prefix = 'Before\n\n```text\n'
    const markdown = `${prefix}hello world\nsecond line\n\`\`\`\n\nAfter`
    setFileObject(id, { id, name: 'code.md', content: markdown, kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    const { container } = render(<TextEditor active id={id} fileTypeConfig={{
      type: 'markdown', defaultMode: EditorViewType.SOURCECODE,
      supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE],
    }} />)
    await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)).toBeDefined())
    await act(async () => {
      const source = sourceCodeCodemirrorViewMap.get(id)!.cm
      expect(source.state.doc.toString()).toBe(markdown)
      source.focus()
      source.dispatch({ selection: { anchor: prefix.length + 18, head: prefix.length + 2 } })
    })

    for (let cycle = 0; cycle < 2; cycle += 1) {
      await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.WYSIWYG))
      await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
      await waitFor(() => expect(container.querySelector('.cm-content')).not.toBeNull())
      const embedded = EditorView.findFromDOM(container.querySelector<HTMLElement>('.cm-content')!)!
      expect(embedded.state.doc.toString()).toBe('hello world\nsecond line')
      await waitFor(() => expect(document.activeElement).toBe(embedded.contentDOM))
      expect(embedded.state.selection.main).toMatchObject(
        cycle === 0 ? { anchor: 18, head: 2 } : { anchor: 8, head: 3 },
      )
      if (cycle === 0) {
        await act(async () => embedded.dispatch({ selection: { anchor: 8, head: 3 } }))
      }

      await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.SOURCECODE))
      await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)).toBeDefined())
      const source = sourceCodeCodemirrorViewMap.get(id)!.cm
      await waitFor(() => expect(source.hasFocus).toBe(true))
      expect(source.state.selection.main).toMatchObject({
        anchor: prefix.length + 8,
        head: prefix.length + 3,
      })
      expect(source.state.doc.toString()).toBe(markdown)
    }
  })


  it('keeps source mounted and transfers its latest selection after deferred visual preparation', async () => {
    const factory = await capricornRuntime.loadCapricornRuntimeFactory()
    let resolve!: (value: typeof factory) => void
    vi.spyOn(capricornRuntime, 'getLoadedCapricornRuntimeFactory').mockReturnValue(undefined)
    vi.spyOn(capricornRuntime, 'loadCapricornRuntimeFactory').mockReturnValue(new Promise((done) => { resolve = done }))
    const id = 'opening-deferred-visual'
    setFileObject(id, { id, name: 'visual.md', path: '/synthetic/visual.md', kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    const { container } = render(<TextEditor active id={id} fileTypeConfig={{
      type: 'markdown', defaultMode: EditorViewType.SOURCECODE,
      supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE],
    }} />)
    await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)).toBeDefined())
    const source = sourceCodeCodemirrorViewMap.get(id)!
    await act(async () => {
      source.cm.focus()
      source.cm.dispatch({ selection: { anchor: 11, head: 4 } })
    })
    await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.WYSIWYG))
    expect(sourceCodeCodemirrorViewMap.get(id)).toBe(source)
    expect(source.cm.dom.isConnected).toBe(true)
    expect(getCapricornEditor(id)).toBeUndefined()
    const edited = '# Edited while preparing visual mode'
    await act(async () => source.cm.dispatch({
      changes: { from: 0, to: source.cm.state.doc.length, insert: edited },
      selection: { anchor: 14, head: 6 },
    }))
    await act(async () => resolve(factory))
    await waitFor(() => expect(getCapricornEditor(id)?.getMarkdown()).toBe(edited))
    await waitFor(() => expect(document.activeElement).toBe(getCapricornRuntimeInput(container)))
    await waitFor(() => expect(getCapricornEditor(id)?.resume?.capture()).toEqual({
      kind: 'capricorn',
      anchor: { path: [0, 0], offset: 12 },
      focus: { path: [0, 0], offset: 4 },
    }))
    expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()
  })

})
