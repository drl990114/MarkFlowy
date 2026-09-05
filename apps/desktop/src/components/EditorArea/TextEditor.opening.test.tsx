import { act, cleanup, render, waitFor } from '@testing-library/react'
import { enableMapSet } from 'immer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorViewType } from '@/constants/editorViewType'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { setFileObject } from '@/helper/files'
import useEditorStateStore from '@/stores/useEditorStateStore'
import TextEditor from './TextEditor'
import { getCapricornEditor } from './capricornEditorRegistry'

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  error: vi.fn(),
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
vi.mock('zens', () => ({ toast: { error: mocks.error } }))
vi.mock('rme', () => ({
  EditorViewType: { WYSIWYG: 'wysiwyg', SOURCECODE: 'sourceCode', PREVIEW: 'preview' },
  createSourceCodeDelegate: vi.fn(),
  Editor: () => null,
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }))

enableMapSet()
afterEach(cleanup)

describe.skipIf(!isCapricornRuntimeAvailable)('TextEditor opening', () => {
  it('keeps a loaded file clean until its first actual edit', async () => {
    const id = 'opening-file'
    setFileObject(id, { id, name: 'opening.md', path: '/synthetic/opening.md', kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    render(<TextEditor active id={id} groupId='group' fileTypeConfig={{
      type: 'markdown', defaultMode: EditorViewType.WYSIWYG,
      supportedModes: [EditorViewType.WYSIWYG],
    }} />)
    await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 100)))
    expect(mocks.error).not.toHaveBeenCalled()
    expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(false)
    await act(async () => getCapricornEditor(id)?.commands.insertLink?.({ href: 'https://example.com', text: 'Link' }))
    expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(true)
  })
})
