import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { enableMapSet } from 'immer'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EditorViewType } from '@/constants/editorViewType'
import { getFileObject, setFileObject } from '@/helper/files'
import useEditorStateStore from '@/stores/useEditorStateStore'
import TextEditor from './TextEditor'
import { editorAutomationRegistry } from './editorAutomationRegistry'
import type * as Zens from 'zens'

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  error: vi.fn(),
  invoke: vi.fn(async () => ({ status: 'success', revision: 'disk:saved' })),
  runtimeAvailable: true,
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

vi.mock('@/commands', () => ({
  commandRegistry: {
    execute: vi.fn(),
    registerCommand: () => ({ dispose: vi.fn() }),
  },
}))
vi.mock('@/AppThemeProvider', () => ({
  AppEditorThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/helper/clipboard', () => ({ clipboardRead: vi.fn() }))
vi.mock('@/helper/logger', () => ({ logger: { error: mocks.error, warn: vi.fn(), info: vi.fn() } }))
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
  useEditorStore: Object.assign(
    (selector: (state: typeof mocks.editorStore) => unknown) => selector(mocks.editorStore),
    {
      getState: () => mocks.editorStore,
    },
  ),
}))
vi.mock('@/stores/useAppSettingStore', () => {
  const state = {
    settingData: {
      autosave: false,
      autosave_interval: 1000,
      editor_root_font_size: 16,
      editor_root_line_height: '1.7',
    },
  }
  return {
    default: Object.assign((selector: (value: typeof state) => unknown) => selector(state), {
      getState: () => state,
    }),
  }
})
vi.mock('@/stores/useThemeStore', () => ({
  default: (selector: (value: { curTheme: { mode: string } }) => unknown) =>
    selector({ curTheme: { mode: 'light' } }),
}))
vi.mock('./createWysiwygDelegateOptions', () => ({
  createWysiwygDelegateOptions: () => ({}),
  getCurrentEditorInsertDateFormat: vi.fn(),
  normalizeLivePreviewBlockBehavior: () => 'source',
}))
vi.mock('./fileSnapshot', () => ({
  readStableFileSnapshot: async () => ({
    status: 'success',
    content: '<!doctype html><html lang="zh"><body><h1>Original</h1></body></html>',
    revision: 'disk:A',
  }),
}))
vi.mock('./openEditorLink', () => ({ openEditorLink: vi.fn() }))
vi.mock('./pdf-print/PdfPrintController', () => ({ PdfPrintController: () => null }))
vi.mock('./pandoc-export/PandocExportController', () => ({ PandocExportController: () => null }))
vi.mock('zens', async (importOriginal) => ({
  ...(await importOriginal<typeof Zens>()),
  toast: { error: mocks.error },
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }))

import bus from '@/helper/eventBus'
import { EVENT } from '@/constants'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { sourceCodeCodemirrorViewMap } from './sourceCodeEditorRegistry'
import { EXTERNAL_FILE_CONTENT_SYNC_EVENT } from './externalFileChanges'
import { undo } from '@codemirror/commands'
import * as rmeRuntime from './rmeRuntime'

vi.mock('./preview/HtmlPreview', () => ({
  default: ({ content }: { content: string }) => (
    <div className='mf-preview-content' data-html-preview={content} />
  ),
}))
vi.mock('@/services/local-history', () => ({
  releaseClosedFileContent: vi.fn(async () => true),
  observeHistoryFile: vi.fn(async () => {}),
  endHistoryBatch: vi.fn(),
  protectLocalEdit: vi.fn(async () => {}),
  historyFileSaved: vi.fn(),
  isHistoryAutosavePaused: () => false,
}))

enableMapSet()
beforeEach(() => vi.clearAllMocks())
afterEach(async () => {
  await act(async () => cleanup())
  vi.restoreAllMocks()
})
const htmlConfig = {
  type: 'html' as const,
  defaultMode: EditorViewType.PREVIEW,
  supportedModes: [EditorViewType.PREVIEW, EditorViewType.SOURCECODE],
}
function seed(id: string) {
  setFileObject(id, { id, name: 'index.html', path: '/site/index.html', kind: 'file' })
  useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
}
async function switchTo(
  id: string,
  mode: typeof EditorViewType.PREVIEW | typeof EditorViewType.SOURCECODE,
) {
  await act(async () => bus.emit('editor_toggle_type', undefined, mode))
  await waitFor(() => expect(useEditorViewTypeStore.getState().getEditorViewType(id)).toBe(mode))
}

it.each([false, true])('keeps the latest content when source loading finishes after returning to preview: %s', async (returnToPreview) => {
  const runtime = await rmeRuntime.loadRmeRuntime()
  let resolve!: (value: typeof runtime) => void
  vi.spyOn(rmeRuntime, 'getLoadedRmeRuntime').mockReturnValue(undefined)
  vi.spyOn(rmeRuntime, 'loadRmeRuntime').mockReturnValue(new Promise((yes) => { resolve = yes }))
  const id = `html-pending-source-${returnToPreview}`
  seed(id)
  const { container } = render(<TextEditor active id={id} fileTypeConfig={htmlConfig} />)
  await waitFor(() => expect(container.querySelector('[data-html-preview]')).not.toBeNull())
  await switchTo(id, EditorViewType.SOURCECODE)
  expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()
  await act(async () => bus.emit(EXTERNAL_FILE_CONTENT_SYNC_EVENT, undefined, {
    fileId: id, content: '<h1>Arrived during loading</h1>',
  }))
  if (returnToPreview) await switchTo(id, EditorViewType.PREVIEW)
  await act(async () => resolve(runtime))
  if (returnToPreview) {
    expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()
    expect(container.querySelector('[data-html-preview]')?.getAttribute('data-html-preview')).toBe('<h1>Arrived during loading</h1>')
    await switchTo(id, EditorViewType.SOURCECODE)
  }
  await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)?.cm.state.doc.toString()).toBe('<h1>Arrived during loading</h1>'))
  expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(false)
})

it('retries a failed initial source import without rereading or replacing the document', async () => {
  const runtime = await rmeRuntime.loadRmeRuntime()
  vi.spyOn(rmeRuntime, 'getLoadedRmeRuntime').mockReturnValue(undefined)
  const load = vi.spyOn(rmeRuntime, 'loadRmeRuntime').mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(runtime)
  const id = 'html-source-retry'
  seed(id)
  useEditorViewTypeStore.getState().setEditorViewType(id, EditorViewType.SOURCECODE)
  const { getByRole } = render(<TextEditor active id={id} fileTypeConfig={htmlConfig} />)
  await waitFor(() => expect(getByRole('alert').textContent).toContain('Unavailable'))
  await act(async () => bus.emit(EXTERNAL_FILE_CONTENT_SYNC_EVENT, undefined, {
    fileId: id, content: '<p>Newer document</p>',
  }))
  fireEvent.click(getByRole('button', { name: 'common.retry' }))
  await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)?.cm.state.doc.toString()).toBe('<p>Newer document</p>'))
  expect(load).toHaveBeenCalledTimes(2)
  expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(false)
})

it('does not take focus when source loading completes after its tab becomes hidden', async () => {
  const runtime = await rmeRuntime.loadRmeRuntime()
  let resolve!: (value: typeof runtime) => void
  vi.spyOn(rmeRuntime, 'getLoadedRmeRuntime').mockReturnValue(undefined)
  vi.spyOn(rmeRuntime, 'loadRmeRuntime').mockReturnValue(new Promise((yes) => { resolve = yes }))
  const id = 'hidden-source-loading'
  seed(id)
  useEditorViewTypeStore.getState().setEditorViewType(id, EditorViewType.SOURCECODE)
  const content = (visible: boolean) => <>
    <input data-testid='other-document-input' />
    <TextEditor active={visible} visible={visible} id={id} fileTypeConfig={htmlConfig} />
  </>
  const view = render(content(true))
  view.rerender(content(false))
  const input = view.getByTestId('other-document-input')
  act(() => input.focus())
  await act(async () => resolve(runtime))
  await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)).toBeDefined())
  expect(document.activeElement).toBe(input)
})

it('previews HTML directly and retains the actual source editor and undo across unsaved switches', async () => {
  const id = 'html-edit-preview'
  seed(id)
  const save = vi.fn()
  bus.on(EVENT.app_save, save)
  try {
    const { container } = render(<TextEditor active id={id} fileTypeConfig={htmlConfig} />)
    await waitFor(() => expect(container.querySelector('[data-html-preview]')).not.toBeNull())
    expect(container.querySelector('[data-cap-content]')).toBeNull()
    expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()
    const original = getFileObject(id)!.content!
    await switchTo(id, EditorViewType.SOURCECODE)
    await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)).toBeDefined())
    const source = sourceCodeCodemirrorViewMap.get(id)!
    expect(source.cm.state.doc.toString()).toBe(original)
    await act(async () =>
      source.cm.dispatch({
        changes: { from: 0, to: source.cm.state.doc.length, insert: '<h1>Unsaved</h1>' },
      }),
    )
    await switchTo(id, EditorViewType.PREVIEW)
    await waitFor(() =>
      expect(
        container.querySelector('[data-html-preview]')?.getAttribute('data-html-preview'),
      ).toBe('<h1>Unsaved</h1>'),
    )
    expect(save).not.toHaveBeenCalled()
    expect(source.cm.dom.isConnected).toBe(true)
    expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(true)
    await switchTo(id, EditorViewType.SOURCECODE)
    expect(sourceCodeCodemirrorViewMap.get(id)).toBe(source)
    await act(async () => {
      expect(undo(source.cm)).toBe(true)
    })
    expect(source.cm.state.doc.toString()).toBe(original)
  } finally {
    bus.detach(EVENT.app_save, save)
  }
})

it('updates an HTML preview from external content and keeps it clean', async () => {
  const id = 'html-external'
  seed(id)
  const { container } = render(<TextEditor active id={id} fileTypeConfig={htmlConfig} />)
  await waitFor(() => expect(container.querySelector('[data-html-preview]')).not.toBeNull())
  await act(async () =>
    bus.emit(EXTERNAL_FILE_CONTENT_SYNC_EVENT, undefined, {
      fileId: id,
      content: '<p>Changed on disk</p>',
    }),
  )
  await waitFor(() =>
    expect(container.querySelector('[data-html-preview]')?.getAttribute('data-html-preview')).toBe(
      '<p>Changed on disk</p>',
    ),
  )
  expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(false)
  expect(editorAutomationRegistry.get(id)?.readContent()).toBe('<p>Changed on disk</p>')
})

it('synchronizes HTML source and view changes across two visible panes', async () => {
  const id = 'html-two-panes'
  seed(id)
  const { container } = render(
    <>
      <TextEditor active visible id={id} groupId='left' fileTypeConfig={htmlConfig} />
      <TextEditor active={false} visible id={id} groupId='right' fileTypeConfig={htmlConfig} />
    </>,
  )
  await waitFor(() => expect(container.querySelectorAll('[data-html-preview]')).toHaveLength(2))
  await switchTo(id, EditorViewType.SOURCECODE)
  await waitFor(() => expect(container.querySelectorAll('.cm-editor')).toHaveLength(2))
  const source = sourceCodeCodemirrorViewMap.get(id)!
  await act(async () =>
    source.cm.dispatch({
      changes: { from: 0, to: source.cm.state.doc.length, insert: '<p>Shared source</p>' },
    }),
  )
  await switchTo(id, EditorViewType.PREVIEW)
  await waitFor(() => {
    const previews = container.querySelectorAll('[data-html-preview]')
    expect(previews).toHaveLength(2)
    previews.forEach((element) =>
      expect(element.getAttribute('data-html-preview')).toBe('<p>Shared source</p>'),
    )
  })
})
