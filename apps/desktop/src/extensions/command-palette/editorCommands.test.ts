// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { history } from '@codemirror/commands'
import { enableMapSet } from 'immer'
import type { MfCodemirrorView } from 'rme'
import type * as ZensModule from 'zens'
import { setCapricornEditor } from '@/components/EditorArea/capricornEditorRegistry'
import type {
  CapricornRuntimeAdapter,
  CapricornUiState,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import { sourceCodeCodemirrorViewMap } from '@/components/EditorArea/sourceCodeEditorRegistry'
import { requestImageInsert } from '@/components/EditorArea/requestImageInsert'
import { clipboardRead } from '@/helper/clipboard'
import useEditorStore from '@/stores/useEditorStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import { EditorViewType } from '@/constants/editorViewType'
import { commandRegistry } from '@/commands'
import useLayoutStore from '@/stores/useLayoutStore'
import { paletteCommands } from './paletteCommands'
import {
  captureEditorCommandTarget,
  editorCommandUnavailable,
  executeEditorPaletteCommand,
  releaseEditorCommandTarget,
} from './editorCommands'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@/helper/clipboard', () => ({
  clipboardRead: vi.fn().mockResolvedValue({ text: 'https://example.com' }),
}))
vi.mock('@/components/EditorArea/requestImageInsert', () => ({ requestImageInsert: vi.fn() }))
// Exercise the shared source commands without rebuilding their checked-out package artifacts.
vi.mock(
  '@markflowy/interface',
  () => import('../../../../../packages/interface/src/components/Toolbar/CodeCommandButton'),
)
vi.mock('@/helper/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('zens', async (importOriginal) => ({
  ...(await importOriginal<typeof ZensModule>()),
  toast: { error: vi.fn() },
}))

let view: EditorView | undefined
beforeAll(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => document.createElement('div').getBoundingClientRect(),
  })
})
beforeEach(() => {
  enableMapSet()
  vi.clearAllMocks()
  useEditorStore.setState({ activeId: 'file', activeGroupId: 'left', opened: ['file'] })
  useFileTypeConfigStore.getState().setFileTypeConfig('file', {
    type: 'markdown',
    defaultMode: EditorViewType.WYSIWYG,
    supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE, EditorViewType.PREVIEW],
  })
})
afterEach(() => {
  setCapricornEditor('file', undefined)
  sourceCodeCodemirrorViewMap.clear()
  view?.destroy()
  view = undefined
  document.body.replaceChildren()
})

function source(readOnly = false) {
  useEditorViewTypeStore.getState().setEditorViewType('file', EditorViewType.SOURCECODE)
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc: 'hello world',
      selection: { anchor: 0, head: 5 },
      extensions: [history(), EditorState.readOnly.of(readOnly)],
    }),
  })
  sourceCodeCodemirrorViewMap.set('file', { cm: view } as MfCodemirrorView)
  return view
}

function richEditor() {
  useEditorViewTypeStore.getState().setEditorViewType('file', EditorViewType.WYSIWYG)
  const state: CapricornUiState = {
    canUndo: true,
    canRedo: false,
    currentBlockType: 'paragraph',
    listType: null,
    markStates: {},
    readOnly: false,
  }
  const editor = {
    getUiState: () => state,
    focus: vi.fn(),
    commands: { toggleMark: vi.fn(), undo: vi.fn(), redo: vi.fn() },
    selection: {
      capture: vi.fn(() => ({
        id: 'selection',
        text: 'hello',
        isCollapsed: false,
        canInsertInline: true,
        link: null,
        image: null,
      })),
      restore: vi.fn(() => true),
      isValid: vi.fn(() => true),
      release: vi.fn(),
    },
    requestInlineEdit: vi.fn(() => true),
  } as unknown as CapricornRuntimeAdapter
  setCapricornEditor('file', editor)
  return { editor, state }
}

describe('palette editor execution', () => {
  it('delegates document and layout actions to existing application commands', async () => {
    source()
    const context = { target: captureEditorCommandTarget(), platform: 'mac' as const }
    for (const id of [
      'app_save',
      'app_closeCurrentEditorTab',
      'app_splitEditorRight',
      'app_splitEditorDown',
    ]) {
      const handler = vi.fn()
      const registration = commandRegistry.registerCommand({ id, handler })
      const command = paletteCommands.find((item) => item.id === id)!
      expect(command.getUnavailableReason(context)).toBeUndefined()
      expect(await command.execute(context)).toBe(true)
      expect(handler).toHaveBeenCalledOnce()
      useEditorStore.setState({ activeGroupId: 'other' })
      expect(await command.execute(context)).toBe(false)
      expect(handler).toHaveBeenCalledOnce()
      useEditorStore.setState({ activeGroupId: 'left' })
      registration.dispose()
    }
    expect(paletteCommands.some((command) => command.id === 'edit_bookmark_dialog')).toBe(false)
  })

  it('explains missing documents, unsupported modes, platform actions and Zen restrictions', () => {
    const context = { target: null, platform: 'linux' as const }
    const reason = (id: string) =>
      paletteCommands.find((item) => item.id === id)!.getUnavailableReason(context)
    expect(reason('app_save')).toBe('no_document')
    expect(reason('app_splitEditorRight')).toBe('no_document')
    expect(reason('app_hide')).toBe('unavailable')
    useLayoutStore.setState({ zenModeActive: true })
    expect(reason('app_toggleLeftsidebarVisible')).toBe('zen_mode')
    useLayoutStore.setState({ zenModeActive: false })
    source()
    useEditorViewTypeStore.getState().setEditorViewType('file', EditorViewType.PREVIEW)
    expect(
      paletteCommands
        .find((item) => item.id === 'app_findReplaceEditor')!
        .getUnavailableReason({ ...context, target: captureEditorCommandTarget() }),
    ).toBe('preview')
  })

  it('restores a rich-text bookmark before editing and releases only its own bookmark', async () => {
    const { editor } = richEditor()
    const target = captureEditorCommandTarget()
    await executeEditorPaletteCommand(target, 'editor_toggleStrong')
    expect(editor.selection!.restore).toHaveBeenCalledWith('selection')
    expect(editor.commands.toggleMark).toHaveBeenCalledWith('bold')
    expect(vi.mocked(editor.selection!.restore).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(editor.commands.toggleMark).mock.invocationCallOrder[0],
    )
    releaseEditorCommandTarget(target)
    expect(editor.selection!.release).toHaveBeenCalledExactlyOnceWith('selection')
  })

  it.each(['editor_insertLink', 'editor_insertImage'] as const)(
    'hands focus to the existing inline flow for %s',
    async (command) => {
      const { editor } = richEditor()
      expect(await executeEditorPaletteCommand(captureEditorCommandTarget(), command)).toBe(true)
      expect(editor.requestInlineEdit).toHaveBeenCalledWith(
        command === 'editor_insertLink' ? 'link' : 'image',
      )
      expect(vi.mocked(editor.focus).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(editor.requestInlineEdit!).mock.invocationCallOrder[0],
      )
    },
  )

  it('rejects another group, replacement editor, invalid bookmark, readonly and preview', async () => {
    const { editor, state } = richEditor()
    const target = captureEditorCommandTarget()
    useEditorStore.setState({ activeGroupId: 'right' })
    expect(await executeEditorPaletteCommand(target, 'editor_toggleStrong')).toBe(false)
    useEditorStore.setState({ activeGroupId: 'left' })
    state.readOnly = true
    expect(editorCommandUnavailable(target, 'editor_toggleStrong')).toBe('read_only')
    state.readOnly = false
    vi.mocked(editor.selection!.isValid).mockReturnValue(false)
    expect(editorCommandUnavailable(target, 'editor_toggleStrong')).toBe('selection_unavailable')
    setCapricornEditor('file', { ...editor })
    expect(editorCommandUnavailable(target, 'editor_toggleStrong')).toBe('stale_target')
    useEditorViewTypeStore.getState().setEditorViewType('file', EditorViewType.PREVIEW)
    expect(editorCommandUnavailable(captureEditorCommandTarget(), 'editor_toggleStrong')).toBe(
      'preview',
    )
    expect(editor.commands.toggleMark).not.toHaveBeenCalled()
  })

  it('formats the original source selection once, and supports undo and redo', async () => {
    const cm = source()
    const target = captureEditorCommandTarget()
    expect(target?.sourceState?.selection.main.to).toBe(5)
    expect(editorCommandUnavailable(target, 'editor_undo')).toBe('no_undo')
    cm.dispatch({ selection: { anchor: 11 } })
    expect(await executeEditorPaletteCommand(target, 'editor_toggleStrong')).toBe(true)
    expect(cm.state.doc.toString()).toBe('**hello** world')
    expect(await executeEditorPaletteCommand(captureEditorCommandTarget(), 'editor_undo')).toBe(
      true,
    )
    expect(cm.state.doc.toString()).toBe('hello world')
    expect(await executeEditorPaletteCommand(captureEditorCommandTarget(), 'editor_redo')).toBe(
      true,
    )
    expect(cm.state.doc.toString()).toBe('**hello** world')
  })

  it('rejects a changed source document or readonly source without inserting Markdown', async () => {
    const cm = source()
    const target = captureEditorCommandTarget()
    cm.dispatch({ changes: { from: 0, insert: 'changed ' } })
    expect(editorCommandUnavailable(target, 'editor_toggleStrong')).toBe('stale_target')
    expect(await executeEditorPaletteCommand(target, 'editor_toggleStrong')).toBe(false)
    cm.setState(EditorState.create({ doc: 'readonly', extensions: EditorState.readOnly.of(true) }))
    expect(editorCommandUnavailable(captureEditorCommandTarget(), 'editor_toggleStrong')).toBe(
      'read_only',
    )
  })

  it('keeps a clipboard request bound to the original source selection and group', async () => {
    const cm = source()
    let resolve!: (value: Awaited<ReturnType<typeof clipboardRead>>) => void
    vi.mocked(clipboardRead).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const pending = executeEditorPaletteCommand(captureEditorCommandTarget(), 'editor_insertLink')
    useEditorStore.setState({ activeGroupId: 'right' })
    resolve({ text: 'https://example.com', html: '' })
    expect(await pending).toBe(false)
    expect(cm.state.doc.toString()).toBe('hello world')
    useEditorStore.setState({ activeGroupId: 'left' })
    expect(
      await executeEditorPaletteCommand(captureEditorCommandTarget(), 'editor_insertLink'),
    ).toBe(true)
    expect(cm.state.doc.toString()).toBe('[hello](https://example.com) world')
  })

  it('inserts source images through the existing dialog and handles cancellation', async () => {
    const cm = source()
    vi.mocked(requestImageInsert).mockResolvedValueOnce(null)
    expect(
      await executeEditorPaletteCommand(captureEditorCommandTarget(), 'editor_insertImage'),
    ).toBe(false)
    expect(cm.state.doc.toString()).toBe('hello world')
    vi.mocked(requestImageInsert).mockResolvedValueOnce({ src: 'https://example.com/a.png' })
    expect(
      await executeEditorPaletteCommand(captureEditorCommandTarget(), 'editor_insertImage'),
    ).toBe(true)
    expect(cm.state.doc.toString()).toBe('![hello](https://example.com/a.png) world')
  })
})
