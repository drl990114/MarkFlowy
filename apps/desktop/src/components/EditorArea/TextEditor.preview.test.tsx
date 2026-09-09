import { act, cleanup, render, waitFor } from '@testing-library/react'
import { enableMapSet } from 'immer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorViewType } from '@/constants/editorViewType'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import type * as CapricornRuntimeConstants from '@/constants/capricornRuntime'
import { getFileObject, setFileObject } from '@/helper/files'
import useEditorStateStore from '@/stores/useEditorStateStore'
import TextEditor from './TextEditor'
import { getCapricornEditor } from './capricornEditorRegistry'

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  error: vi.fn(),
  invoke: vi.fn(async () => ({ status: 'success', revision: 'disk:saved' })),
  runtimeAvailable: true,
  rmeEditor: vi.fn(() => null),
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
    content: '# Opened file\n\nBody\n',
    revision: 'disk:A',
  }),
}))
vi.mock('./openEditorLink', () => ({ openEditorLink: vi.fn() }))
vi.mock('./pdf-print/PdfPrintController', () => ({ PdfPrintController: () => null }))
vi.mock('./pandoc-export/PandocExportController', () => ({ PandocExportController: () => null }))
vi.mock('zens', () => ({ toast: { error: mocks.error } }))
vi.mock('rme', () => ({
  EditorViewType: { WYSIWYG: 'wysiwyg', SOURCECODE: 'sourceCode', PREVIEW: 'preview' },
  createSourceCodeDelegate: vi.fn(() => ({ view: 'SourceCode', manager: { mounted: false } })),
  Editor: mocks.rmeEditor,
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }))

import bus from '@/helper/eventBus'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { EXTERNAL_FILE_CONTENT_SYNC_EVENT } from './externalFileChanges'

vi.mock('@/constants/capricornRuntime', async (importOriginal) => {
  const actual = await importOriginal<typeof CapricornRuntimeConstants>()
  return {
    ...actual,
    get isCapricornRuntimeAvailable() {
      return mocks.runtimeAvailable && actual.isCapricornRuntimeAvailable
    },
  }
})

enableMapSet()
beforeEach(() => {
  mocks.runtimeAvailable = true
  vi.clearAllMocks()
})
afterEach(async () => {
  await act(async () => cleanup())
})

const previewConfig = {
  type: 'markdown' as const,
  defaultMode: EditorViewType.PREVIEW,
  supportedModes: [EditorViewType.WYSIWYG, EditorViewType.PREVIEW, EditorViewType.SOURCECODE],
}
function seedFile(id: string) {
  setFileObject(id, { id, name: 'preview.md', path: `/synthetic/${id}.md`, kind: 'file' })
  useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
}

describe.skipIf(!isCapricornRuntimeAvailable)('TextEditor preview integration', () => {
  it('opens a Capricorn preview and synchronizes external content without marking it dirty', async () => {
    const id = 'preview-external-file'
    seedFile(id)
    const { container } = render(<TextEditor active id={id} fileTypeConfig={previewConfig} />)
    await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
    expect(container.querySelector('[data-cap-mode="preview"]')).not.toBeNull()
    expect(getCapricornEditor(id)!.getUiState().readOnly).toBe(true)
    expect(mocks.rmeEditor).not.toHaveBeenCalled()
    await act(async () => {
      bus.emit(EXTERNAL_FILE_CONTENT_SYNC_EVENT, undefined, {
        fileId: id,
        content: '# Changed externally\n\nNew body',
      })
    })
    expect(container.textContent).toContain('Changed externally')
    expect(getCapricornEditor(id)!.getMarkdown()).toBe('# Changed externally\n\nNew body')
    expect(getFileObject(id)?.content).toBe('# Changed externally\n\nNew body')
    expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(false)
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('retains the runtime between edit and preview, and seeds it from Source Code changes', async () => {
    const id = 'preview-switch-file'
    seedFile(id)
    const { container } = render(<TextEditor active id={id} fileTypeConfig={previewConfig} />)
    await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
    const editor = getCapricornEditor(id)!
    const root = container.querySelector('[data-cap-content]')
    const switchTo = async (mode: (typeof EditorViewType)[keyof typeof EditorViewType]) => {
      await act(async () => bus.emit('editor_toggle_type', undefined, mode))
      await waitFor(() =>
        expect(useEditorViewTypeStore.getState().editorViewTypeMap.get(id)).toBe(mode),
      )
    }
    await switchTo(EditorViewType.WYSIWYG)
    await waitFor(() => expect(editor.getUiState().readOnly).toBe(false))
    await act(async () => editor.commands.setBlockType('heading-2'))
    const edited = editor.getMarkdown()
    expect(edited).toContain('## Opened file')
    await switchTo(EditorViewType.PREVIEW)
    await waitFor(() => expect(editor.getUiState().readOnly).toBe(true))
    expect(getCapricornEditor(id)).toBe(editor)
    expect(container.querySelector('[data-cap-content]')).toBe(root)
    expect(editor.getMarkdown()).toBe(edited)
    expect(getFileObject(id)?.content).toBe(edited)
    expect(editor.getUiState().canUndo).toBe(true)
    expect(mocks.rmeEditor).not.toHaveBeenCalled()

    await switchTo(EditorViewType.SOURCECODE)
    await waitFor(() => expect(getCapricornEditor(id)).toBeUndefined())
    expect(mocks.rmeEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        content: edited,
        initialType: EditorViewType.SOURCECODE,
      }),
      undefined,
    )
    await act(async () => bus.emit('editor_set_content', undefined, '# Edited as source'))
    await switchTo(EditorViewType.PREVIEW)
    await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
    expect(container.querySelector('[data-cap-mode="preview"]')).not.toBeNull()
    expect(getCapricornEditor(id)!.getMarkdown()).toBe('# Edited as source')
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('keeps the RME preview available without the optional Capricorn package', async () => {
    mocks.runtimeAvailable = false
    const id = 'preview-fallback-file'
    seedFile(id)
    const { container } = render(<TextEditor active id={id} fileTypeConfig={previewConfig} />)
    await waitFor(() => expect(mocks.rmeEditor).toHaveBeenCalled())
    expect(mocks.rmeEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '# Opened file\n\nBody\n',
        initialType: EditorViewType.PREVIEW,
      }),
      undefined,
    )
    expect(container.querySelector('[data-mf-capricorn-runtime]')).toBeNull()
    expect(getCapricornEditor(id)).toBeUndefined()
    expect(mocks.error).not.toHaveBeenCalled()
  })
})
