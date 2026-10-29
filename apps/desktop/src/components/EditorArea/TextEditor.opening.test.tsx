// @vitest-environment jsdom
import { EditorView } from '@codemirror/view'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { enableMapSet } from 'immer'
import { save as saveDialog } from '@tauri-apps/plugin-dialog'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type * as Rme from 'rme'
import type * as Zens from 'zens'
import type * as LocalHistory from '@/services/local-history'
import { EditorViewType } from '@/constants/editorViewType'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import bus from '@/helper/eventBus'
import { getFileObject, getSaveOpenedEditorEntries, setFileObject } from '@/helper/files'
import { createFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import { createEditorResumeStore } from '@/stores/editorResumeStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import TextEditor from './TextEditor'
import EditorLayoutView from './EditorLayoutView'
import { fileSaveCoordinator } from './fileSaveCoordinator'
import { editorSnapshotRegistry } from './editorSnapshotRegistry'
import { getCapricornEditor } from './capricornEditorRegistry'
import { editorAutomationRegistry } from './editorAutomationRegistry'
import { getCapricornRuntimeInput } from './capricornRuntimeDom'
import { EXTERNAL_FILE_CONTENT_SYNC_EVENT } from './externalFileChanges'
import { getSourceCodeEditor, sourceCodeCodemirrorViewMap } from './sourceCodeEditorRegistry'
import * as rmeRuntime from './rmeRuntime'
import * as capricornRuntime from './capricornRuntimeAdapter'
import * as conditionalFileWrite from './conditionalFileWrite'
import { bindRecoveredDraft, endHistoryBatch, historyCall, releaseClosedFileContent } from '@/services/local-history'
import { stageDraftRecovery } from '@/services/staged-draft-recovery'
import { registerDraftRecovery } from '@/services/draftRecoveryState'
import type { DraftDescriptor } from '@/services/draftSessionFormat'
import { TooltipProvider } from '@/components/ui/tooltip'
import { desktopDarkTheme } from '@markflowy/theme'
import { ThemeProvider } from 'styled-components'
import { WysiwygToolbar } from './editorToolBar/WysiwygToolbar/WysiwygToolbar'
import { SourceCodeToolbar } from './editorToolBar/SourceCodeToolbar/SourceCodeToolbar'
import { PreviewToolbar } from './editorToolBar/PreviewToolbar/PreviewToolbar'
import type { IShowContextMenuParams } from '@/stores/useContextMenuStore'
import { EVENT } from '@/constants'
import EditorArea from './index'


const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  error: vi.fn(),
  rmeLoaded: vi.fn(),
  showMenu: vi.fn<(params: IShowContextMenuParams) => void>(),
  registerCommand: vi.fn<(command: { id: string; handler: () => void }) => { dispose: () => void }>(() => ({ dispose: vi.fn() })),
  invoke: vi.fn(async (command: string) =>
    command === 'get_snippets'
      ? { version: 1, revision: 0, items: [], hiddenBuiltinIds: [] }
      : { status: 'success', revision: 'disk:saved' },
  ),
}))

vi.mock('@/commands', () => ({ commandRegistry: {
  execute: vi.fn(),
  registerCommand: mocks.registerCommand,
} }))
vi.mock('@/AppThemeProvider', () => ({ AppEditorThemeProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/helper/clipboard', () => ({ clipboardRead: vi.fn() }))
vi.mock('@/helper/logger', () => ({ logger: { error: mocks.error, info: vi.fn(), warn: vi.fn() } }))
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
  t: mocks.t,
  useTranslation: () => ({ t: mocks.t }),
}))
vi.mock('@/services/error-reporting', () => ({ captureException: mocks.error }))
vi.mock('@/stores', async () => ({
  useEditorStateStore: (await import('@/stores/useEditorStateStore')).default,
  // Defer forwarding until render so the barrel does not await its own store's import cycle.
  useEditorStore: Object.assign(
    <T,>(selector: (state: ReturnType<typeof useEditorStore.getState>) => T) => useEditorStore(selector),
    { getState: () => useEditorStore.getState() },
  ),
}))
vi.mock('react-resizable-panels', () => {
  const Box = ({ children, className }: PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>
  return { Group: Box, Panel: Box, Separator: () => null }
})
vi.mock('overlayscrollbars-react', () => ({
  OverlayScrollbarsComponent: ({ children, className }: PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
}))
vi.mock('./EditorAreaTabs', () => ({ default: () => null }))
vi.mock('./EditorGroupToolbar', () => ({ default: () => null }))
vi.mock('./editorAreaLoader', () => ({ loadEditorAreaContent: async () => ({ default: () => null }) }))
vi.mock('./editorToolBar/components/MenuList', () => ({ MenuList: () => null }))
vi.mock('@/components/ui-v2/ContextMenu', () => ({ showContextMenu: mocks.showMenu }))
vi.mock('./EmptyState', () => ({ EmptyState: () => null }))
vi.mock('./ExternalFileChangeAlert', () => ({ ExternalFileChangeAlert: () => null }))
vi.mock('./editorToolBar/FindReplace', () => ({ FindReplace: () => null }))
vi.mock('@/stores/useAppSettingStore', () => {
  const state = { settingData: { autosave: false, autosave_interval: 1000, editor_root_font_size: 16, editor_root_line_height: '1.7' } }
  return { default: Object.assign((selector: (value: typeof state) => unknown) => selector(state), { getState: () => state, subscribe: () => () => {} }) }
})
vi.mock('@/stores/useThemeStore', () => ({ default: (selector: (value: { curTheme: { mode: string } }) => unknown) => selector({ curTheme: { mode: 'light' } }) }))
vi.mock('./createWysiwygDelegateOptions', () => ({
  createWysiwygDelegateOptions: () => ({}),
  getCurrentEditorInsertDateFormat: vi.fn(),
  normalizeLivePreviewBlockBehavior: () => 'source',
}))
vi.mock('./fileSnapshot', () => ({
  readStableFileSnapshot: async () => ({ status: 'success', content: '# Opened file\n\nBody\n', revision: 'disk:A' }),
  promoteOpeningRead: vi.fn(),
}))
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
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, isTauri: () => true }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'main' }) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }))
vi.mock('@/services/local-history', () => ({
  releaseClosedFileContent: vi.fn(async () => true),
  observeHistoryFile: vi.fn(async () => {}),
  endHistoryBatch: vi.fn(),
  protectLocalEdit: vi.fn(async () => {}),
  historyFileSaved: vi.fn(),
  isHistoryAutosavePaused: () => false,
  bindRecoveredDraft: vi.fn(async () => {}),
  draftProtectionStarted: () => true,
  flushDraftProtection: vi.fn(async () => {}),
  historyCall: vi.fn(async () => []),
  historyWorkspace: () => '/synthetic',
  historyWorkspaceForPath: () => '/synthetic',
  startDraftProtection: vi.fn(async () => {}),
  ownsHistoryDraft: () => false,
  retainHistoryDraftOnClose: vi.fn(async () => {}),
}))

enableMapSet()
beforeAll(() => {
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null })
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

describe.skipIf(!isCapricornRuntimeAvailable)('TextEditor document lifecycle', () => {
  let history: typeof LocalHistory
  // Prepare both real modules before taking per-test state snapshots. A cold
  // import inside a timed-out test can resume later and clean up the next test.
  beforeAll(async () => {
    const [loadedHistory] = await Promise.all([
      vi.importActual<typeof LocalHistory>('@/services/local-history'),
      capricornRuntime.loadCapricornRuntimeFactory(),
    ])
    history = loadedHistory
  }, 30_000)

  it('keeps a hidden dirty document through its first split and saves its original draft', async () => {
    const previous = useEditorStore.getState()
    const previousRelease = vi.mocked(releaseClosedFileContent).getMockImplementation()
    vi.mocked(releaseClosedFileContent).mockImplementation(history.releaseClosedFileContent)
    const alpha = 'first-split-alpha'
    const beta = 'first-split-beta'
    const group = 'first-split-group'
    createFile({ id: alpha, name: 'alpha.md', path: '/synthetic/split/alpha.md', ext: 'md', kind: 'file' })
    createFile({ id: beta, name: 'beta.md', path: '/synthetic/split/beta.md', ext: 'md', kind: 'file' })
    useEditorStore.getState().setEditorLayout({ type: 'leaf', id: group, opened: [alpha, beta], activeId: alpha }, group)
    function WorkspaceEditors() {
      const layout = useEditorStore((state) => state.editorLayout)
      const activeGroupId = useEditorStore((state) => state.activeGroupId)
      return <EditorLayoutView node={layout} activeGroupId={activeGroupId} zenModeActive={false} />
    }
    try {
      const { container } = render(<WorkspaceEditors />)
      await waitFor(() => expect(getCapricornEditor(alpha)).toBeDefined())
      await act(async () => getCapricornEditor(alpha)?.commands.insertLink?.({ href: 'https://example.com', text: 'FIRST-SPLIT-DRAFT' }))
      const draft = getCapricornEditor(alpha)!.getMarkdown()
      expect(draft).toContain('FIRST-SPLIT-DRAFT')
      expect(useEditorStateStore.getState().idStateMap.get(alpha)?.hasUnsavedChanges).toBe(true)
      await act(async () => useEditorStore.getState().setActiveId(beta))
      await waitFor(() => expect(getCapricornEditor(beta)).toBeDefined())
      expect(editorSnapshotRegistry.hasSources(alpha)).toBe(true)

      await act(async () => { useEditorStore.getState().splitGroup(group, 'horizontal') })
      expect(useEditorStore.getState().editorLayout.type).toBe('branch')
      await waitFor(() => expect(editorSnapshotRegistry.hasSources(alpha)).toBe(false))
      expect(useEditorStore.getState().opened).toContain(alpha)
      await act(async () => { await Promise.resolve() })
      expect(useEditorStateStore.getState().idStateMap.get(alpha)?.hasUnsavedChanges).toBe(true)
      expect(getFileObject(alpha)?.content).toBe(draft)
      expect(fileSaveCoordinator.getDiskRevision(alpha)).toBe('disk:A')

      await act(async () => {
        useEditorStore.getState().setActiveGroupId(group)
        useEditorStore.getState().setActiveId(alpha)
      })
      await waitFor(() => expect(getCapricornEditor(alpha)?.getMarkdown()).toBe(draft))
      expect(container.textContent).toContain('FIRST-SPLIT-DRAFT')
      expect(editorAutomationRegistry.get(alpha)?.readContent()).toBe(draft)
      expect(useEditorStateStore.getState().idStateMap.get(alpha)?.hasUnsavedChanges).toBe(true)
      await act(async () => { expect(await getSaveOpenedEditorEntries(alpha)?.()).toBe(true) })
      expect(mocks.invoke).toHaveBeenCalledWith('conditional_write_file', expect.objectContaining({
        filePath: '/synthetic/split/alpha.md', content: draft,
      }))
    } finally {
      cleanup()
      await Promise.resolve()
      useEditorStore.setState(previous)
      if (previousRelease) vi.mocked(releaseClosedFileContent).mockImplementation(previousRelease)
    }
  })

  it('releases a closed clean document after its last editor unmounts', async () => {
    const previous = useEditorStore.getState()
    const previousRelease = vi.mocked(releaseClosedFileContent).getMockImplementation()
    vi.mocked(releaseClosedFileContent).mockImplementation(history.releaseClosedFileContent)
    const id = 'closed-clean-editor'
    const group = 'closed-clean-group'
    createFile({ id, name: 'closed.md', path: '/synthetic/split/closed.md', kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    useEditorStore.getState().setEditorLayout({ type: 'leaf', id: group, opened: [id], activeId: id }, group)
    try {
      const { unmount } = render(<TextEditor active id={id} groupId={group} fileTypeConfig={{
        type: 'markdown', defaultMode: EditorViewType.WYSIWYG,
        supportedModes: [EditorViewType.WYSIWYG],
      }} />)
      await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
      expect(getFileObject(id)?.content).toBe('# Opened file\n\nBody\n')
      expect(fileSaveCoordinator.getDiskRevision(id)).toBe('disk:A')
      expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(false)

      await act(async () => {
        useEditorStore.getState().setEditorLayout({ type: 'leaf', id: group, opened: [] }, group)
        unmount()
      })
      await waitFor(() => expect(fileSaveCoordinator.getDiskRevision(id)).toBeUndefined())
      expect(editorSnapshotRegistry.hasSources(id)).toBe(false)
      expect(getCapricornEditor(id)).toBeUndefined()
      expect(getSaveOpenedEditorEntries(id)).toBeUndefined()
      expect(getFileObject(id)?.content).toBeUndefined()
      expect(useEditorStateStore.getState().idStateMap.has(id)).toBe(false)
    } finally {
      cleanup()
      await Promise.resolve()
      useEditorStore.setState(previous)
      if (previousRelease) vi.mocked(releaseClosedFileContent).mockImplementation(previousRelease)
    }
  })

  it.each(['reopened', 'recovering'] as const)(
    'retains a hidden %s document when an earlier close finishes releasing',
    async (transition) => {
      const previous = useEditorStore.getState()
      const previousRelease = vi.mocked(releaseClosedFileContent).getMockImplementation()
      let finishRelease!: (released: boolean) => void
      const release = new Promise<boolean>((resolve) => { finishRelease = resolve })
      vi.mocked(releaseClosedFileContent).mockImplementation(() => release)
      const id = `close-race-${transition}`
      const group = `close-race-${transition}-group`
      const draft = `# Draft after ${transition}\n`
      let finishRecovery: (() => void) | undefined
      createFile({ id, name: `${transition}.md`, path: `/synthetic/split/${transition}.md`, kind: 'file' })
      useEditorStore.getState().setEditorLayout({ type: 'leaf', id: group, opened: [id], activeId: id }, group)
      try {
        const { unmount } = render(<TextEditor active id={id} groupId={group} fileTypeConfig={{
          type: 'markdown', defaultMode: EditorViewType.WYSIWYG,
          supportedModes: [EditorViewType.WYSIWYG],
        }} />)
        await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
        await act(async () => {
          useEditorStore.getState().setEditorLayout({ type: 'leaf', id: group, opened: [] }, group)
          unmount()
        })
        await waitFor(() => expect(releaseClosedFileContent).toHaveBeenCalledWith(id))
        expect(editorSnapshotRegistry.hasSources(id)).toBe(false)
        if (transition === 'reopened') {
          // The reopened tab is still hidden, so no replacement editor can protect it.
          useEditorStore.getState().setEditorLayout({ type: 'leaf', id: group, opened: [id] }, group)
        } else {
          finishRecovery = registerDraftRecovery(id, () => undefined)
        }
        setFileObject(id, { ...getFileObject(id)!, content: draft })
        fileSaveCoordinator.recordContent(id, draft)
        fileSaveCoordinator.setDiskRevision(id, 'disk:after-close')
        useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: true })

        await act(async () => { finishRelease(true) })
        expect(editorSnapshotRegistry.hasSources(id)).toBe(false)
        expect(fileSaveCoordinator.getDiskRevision(id)).toBe('disk:after-close')
        expect(getFileObject(id)?.content).toBe(draft)
        expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(true)
      } finally {
        finishRelease(false)
        finishRecovery?.()
        cleanup()
        await Promise.resolve()
        useEditorStore.setState(previous)
        if (previousRelease) vi.mocked(releaseClosedFileContent).mockImplementation(previousRelease)
      }
    },
  )

  it('replaces an already mounted disk document when its workspace draft arrives later', async () => {
    const id = 'late-workspace-draft'
    const path = '/synthetic/late-workspace-draft.md'
    const recovered = '# Recovered draft\n\nDRAFT-B-20261024-2330\n'
    const previousEditorState = useEditorStore.getState()
    const previousHistoryCall = vi.mocked(historyCall).getMockImplementation()
    createFile({ id, name: 'late-workspace-draft.md', path, kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    useEditorStore.setState({
      folderData: [createFile({ kind: 'dir', path: '/synthetic' })],
      opened: [id], activeId: id, activeGroupId: 'late-draft-group',
      editorLayout: { type: 'leaf', id: 'late-draft-group', opened: [id], activeId: id },
    })
    const draft: DraftDescriptor = {
      document: { id: 'native-late-draft', name: 'late-workspace-draft.md', path, workspace: '/synthetic', generation: 0 },
      writer: 'closed-child:bravo', sequence: 1, hash: 'draft-hash', paused: true,
      diskRevision: 'disk:A', format: { encoding: 'utf-8', bom: 'none' },
    }
    vi.mocked(historyCall).mockImplementation(async (operation) =>
      operation === 'recoveryDraftIndex' ? [draft] : { ...draft, content: recovered },
    )
    const controller = new AbortController()
    try {
      const { container } = render(<TextEditor active id={id} groupId='late-draft-group' fileTypeConfig={{
        type: 'markdown', defaultMode: EditorViewType.WYSIWYG,
        supportedModes: [EditorViewType.WYSIWYG],
      }} />)
      await waitFor(() => expect(getCapricornEditor(id)?.getMarkdown()).toBe('# Opened file\n\nBody\n'))
      const mounted = getCapricornEditor(id)
      const onError = vi.fn()
      let count = 0
      await act(async () => {
        const recovery = await stageDraftRecovery({ signal: controller.signal, onError })
        count = await recovery.finished
      })
      expect(onError).not.toHaveBeenCalled()
      expect(count).toBe(1)
      expect(getCapricornEditor(id)).toBe(mounted)
      expect(getCapricornEditor(id)?.getMarkdown()).toBe(recovered)
      expect(container.textContent).toContain('DRAFT-B-20261024-2330')
      expect(editorAutomationRegistry.get(id)?.readContent()).toBe(recovered)
      expect(useEditorStore.getState().getEditorContent(id)).toBe(recovered)
      expect(getFileObject(id)?.content).toBe(recovered)
      expect(bindRecoveredDraft).toHaveBeenCalledWith(id, expect.objectContaining({ content: recovered }))
      expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(true)
      await act(async () => {
        expect(await getSaveOpenedEditorEntries(id)?.()).toBe(true)
      })
      expect(mocks.invoke).toHaveBeenCalledWith('conditional_write_file', expect.objectContaining({
        filePath: path, content: recovered,
      }))
    } finally {
      controller.abort()
      cleanup()
      useEditorStore.setState(previousEditorState)
      if (previousHistoryCall) vi.mocked(historyCall).mockImplementation(previousHistoryCall)
      else vi.mocked(historyCall).mockReset()
    }
  })

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
  // Keep RME cold in the opening suite, then prepare the real source-editor fixture
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
    const save = vi.spyOn(conditionalFileWrite, 'conditionalWriteExpectedIfAllowed')
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
      save.mockRestore()
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

  it.each(['canceled', 'failed'] as const)('keeps the target pane and its draft when its save is %s', async (result) => {
    const id = `mode-target-save-${result}`
    setFileObject(id, {
      id,
      name: 'draft.md',
      kind: 'file',
      ...(result === 'failed' ? { path: `/synthetic/${id}.md` } : { content: '# Draft' }),
    })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    const { container } = render(<TextEditor active={false} visible id={id} groupId='target' fileTypeConfig={{
      type: 'markdown', defaultMode: EditorViewType.WYSIWYG,
      supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE],
    }} />)
    await waitFor(() => expect(container.querySelector('[data-cap-content]')).not.toBeNull())
    const editor = getCapricornEditor(id)!
    await act(async () => editor.commands.insertLink?.({ href: 'https://example.com', text: 'Unsaved edit' }))
    const draft = editor.getMarkdown()
    expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(true)

    const write = vi.spyOn(conditionalFileWrite, 'conditionalWriteExpectedIfAllowed')
    if (result === 'failed') write.mockRejectedValueOnce(new Error('Disk unavailable'))
    else vi.mocked(saveDialog).mockResolvedValueOnce(null)

    await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.SOURCECODE, {
      editorId: id,
      groupId: 'target',
    }))
    if (result === 'failed') {
      await waitFor(() => expect(write).toHaveBeenCalled())
      expect(write.mock.calls[0][0]).toBe(`/synthetic/${id}.md`)
    } else {
      await waitFor(() => expect(saveDialog).toHaveBeenCalled())
      expect(write).not.toHaveBeenCalled()
    }
    expect(container.querySelector('[data-cap-content]')).not.toBeNull()
    expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()
    expect(editor.getMarkdown()).toBe(draft)
    expect(useEditorViewTypeStore.getState().getEditorViewType(id)).toBe(EditorViewType.WYSIWYG)
    expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(true)
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

  it.each([
    { name: 'ordered-bullet', markdown: '1. one\n2. two\n   - nested\n', word: 'nested', path: [2, 0] },
    { name: 'bullet-bullet', markdown: '- one\n  - nested\n', word: 'nested', path: [1, 0] },
    { name: 'ordered-ordered', markdown: '1. one\n   1. nested\n', word: 'nested', path: [1, 0] },
    { name: 'before-list', markdown: 'Before paragraph\n\n- one\n  - nested\n', word: 'Before', path: [0, 0] },
    { name: 'after-list', markdown: '- one\n  - nested\n\nAfter paragraph\n', word: 'After', path: [2, 0] },
    { name: 'CRLF-Unicode', markdown: '- one😀\r\n  - nested🦊\r\n', word: 'nested', path: [1, 0] },
  ])('preserves original Markdown and live caret/selection through nested-list mode switches: $name', async ({ name, markdown, word, path }) => {
    const id = `opening-nested-${name}`
    setFileObject(id, { id, name: `${name}.md`, content: markdown, kind: 'file' })
    useEditorStateStore.getState().setIdStateMap(id, { hasUnsavedChanges: false })
    const { container } = render(<TextEditor active id={id} fileTypeConfig={{
      type: 'markdown', defaultMode: EditorViewType.SOURCECODE,
      supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE],
    }} />)
    await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)).toBeDefined())
    const sourceMarkdown = markdown.replace(/\r\n/g, '\n')
    const start = sourceMarkdown.indexOf(word)
    await act(async () => {
      const source = sourceCodeCodemirrorViewMap.get(id)!.cm
      source.focus()
      source.dispatch({ selection: { anchor: start + 2, head: start + 2 } })
    })

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const incoming = cycle === 0 ? { anchor: 2, head: 2 }
        : cycle === 1 ? { anchor: 3, head: 3 } : { anchor: 5, head: 1 }
      await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.WYSIWYG))
      await waitFor(() => expect(getCapricornEditor(id)).toBeDefined())
      const visual = getCapricornEditor(id)!
      await waitFor(() => expect(document.activeElement).toBe(getCapricornRuntimeInput(container)))
      await waitFor(() => expect(visual.resume!.capture()).toEqual({
        kind: 'capricorn',
        anchor: { path, offset: incoming.anchor },
        focus: { path, offset: incoming.head },
      }))
      expect(visual.getMarkdown()).toBe(markdown)
      // Move in WYSIWYG so restoring an old source-mode selection cannot pass.
      // Cover a collapsed caret, then a backward selection and its next round trip.
      const expected = cycle === 0 ? { anchor: 3, head: 3 } : { anchor: 5, head: 1 }
      await act(async () => expect(visual.resume!.restore({
        kind: 'capricorn',
        anchor: { path, offset: expected.anchor },
        focus: { path, offset: expected.head },
      })).toBe(true))

      await act(async () => bus.emit('editor_toggle_type', undefined, EditorViewType.SOURCECODE))
      await waitFor(() => expect(sourceCodeCodemirrorViewMap.get(id)).toBeDefined())
      const source = sourceCodeCodemirrorViewMap.get(id)!
      await waitFor(() => expect(source.cm.state.selection.main).toMatchObject({
        anchor: start + expected.anchor,
        head: start + expected.head,
      }))
      await waitFor(() => expect(source.cm.hasFocus).toBe(true))
      expect(source.content).toBe(markdown)
      expect(source.cm.state.doc.toString()).toBe(sourceMarkdown)
      expect(getFileObject(id)?.content).toBe(markdown)
      expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(false)
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

  it('keeps same-file split modes, toolbars, commands and runtime owners independent', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    await Promise.all([rmeRuntime.loadRmeRuntime(), capricornRuntime.loadCapricornRuntimeFactory()])
    const previous = useEditorStore.getState()
    const previousModes = useEditorViewTypeStore.getState()
    const id = 'same-file-split-modes'
    const left = 'split-modes-left'
    const right = 'split-modes-right'
    createFile({ id, name: 'modes.md', path: '/synthetic/split/modes.md', ext: 'md', kind: 'file' })
    useEditorStore.getState().setEditorLayout({
      type: 'branch', id: 'split-modes', direction: 'horizontal', sizes: [50, 50],
      children: [left, right].map((groupId) => ({ type: 'leaf', id: groupId, opened: [id], activeId: id })),
    }, left)
    const fileTypeConfig = {
      type: 'markdown' as const, defaultMode: EditorViewType.WYSIWYG,
      supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE, EditorViewType.PREVIEW],
    }
    useFileTypeConfigStore.getState().setFileTypeConfig(id, fileTypeConfig)
    function SplitEditors() {
      const state = useEditorStore()
      return <ThemeProvider theme={desktopDarkTheme}><TooltipProvider>
        <EditorArea />
        {[left, right].filter((groupId) => state.getGroup(groupId)).map((groupId) => (
          <section aria-label={groupId} key={groupId}>
            <WysiwygToolbar editorId={id} groupId={groupId} />
            <SourceCodeToolbar editorId={id} groupId={groupId} />
            <PreviewToolbar editorId={id} groupId={groupId} />
            <TextEditor id={id} groupId={groupId} active={state.activeGroupId === groupId} visible fileTypeConfig={fileTypeConfig} />
          </section>
        ))}
      </TooltipProvider></ThemeProvider>
    }
    try {
      const { container } = render(<SplitEditors />)
      const leftPane = container.querySelector<HTMLElement>(`section[aria-label="${left}"]`)!
      const rightPane = container.querySelector<HTMLElement>(`section[aria-label="${right}"]`)!
      const button = (pane: HTMLElement, label: string) => pane.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
      await waitFor(() => {
        expect(button(leftPane, 'view.label: view.wysiwyg')).not.toBeNull()
        expect(button(rightPane, 'view.label: view.wysiwyg')).not.toBeNull()
      })
      const leftEditor = getCapricornEditor(id, left)!
      // A menu can remain open while another pane becomes active.
      fireEvent.click(button(rightPane, 'view.label: view.wysiwyg'))
      const sourceItem = mocks.showMenu.mock.calls.at(-1)![0].items.find((item) => 'value' in item && item.value === EditorViewType.SOURCECODE)
      if (!sourceItem || 'type' in sourceItem) throw new Error('Missing source view menu item')
      await act(async () => sourceItem.handler?.())
      await waitFor(() => expect(rightPane.querySelector('.cm-editor')).not.toBeNull())
      expect(leftPane.querySelector('[data-cap-content]')).not.toBeNull()
      expect(button(leftPane, 'view.label: view.wysiwyg')).not.toBeNull()
      expect(button(rightPane, 'view.label: view.source_code')).not.toBeNull()
      expect(useEditorViewTypeStore.getState().getEditorViewType(id)).toBe(EditorViewType.WYSIWYG)
      expect(getCapricornEditor(id)).toBe(leftEditor)
      expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()
      const rightSource = getSourceCodeEditor(id, right)!
      expect(rightSource.cm.dom.closest('section')).toBe(rightPane)
      const bodyOffset = rightSource.content.indexOf('Body')
      await act(async () => rightSource.cm.dispatch({ selection: { anchor: bodyOffset, head: bodyOffset + 4 } }))
      fireEvent.click(button(rightPane, 'toolbar.bold'))
      expect(rightSource.content).toContain('**Body**')

      // The keyboard command must read the left pane's actual WYSIWYG mode.
      const toggle = mocks.registerCommand.mock.calls.findLast(([command]) => command.id === EVENT.app_toggleEditorType)![0].handler
      await act(async () => toggle())
      await waitFor(() => expect(leftPane.querySelector('.cm-editor')).not.toBeNull())
      expect(getSourceCodeEditor(id, right)).toBe(rightSource)
      await act(async () => toggle())
      await waitFor(() => expect(leftPane.querySelector('[data-cap-content]')).not.toBeNull())
      expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()
      const currentLeftEditor = getCapricornEditor(id, left)!
      await act(async () => useEditorStore.getState().setActiveGroupId(right))
      expect(getCapricornEditor(id)).toBeUndefined()
      const toggleMark = vi.spyOn(currentLeftEditor.commands, 'toggleMark')
      fireEvent.click(button(leftPane, 'toolbar.bold'))
      expect(toggleMark).toHaveBeenCalledWith('bold')
      expect(getSourceCodeEditor(id, right)).toBe(rightSource)

      await act(async () => useEditorStore.getState().closeGroup(right))
      await waitFor(() => expect(getCapricornEditor(id)).toBe(currentLeftEditor))
      expect(getSourceCodeEditor(id, right)).toBeUndefined()
      expect(sourceCodeCodemirrorViewMap.get(id)).toBeUndefined()
      expect(useEditorViewTypeStore.getState().editorGroupViewTypeMap.has(right)).toBe(false)
      expect(button(leftPane, 'view.label: view.wysiwyg')).not.toBeNull()
      await act(async () => toggle())
      await waitFor(() => expect(leftPane.querySelector('.cm-editor')).not.toBeNull())
    } finally {
      cleanup()
      useEditorStore.setState(previous)
      useEditorViewTypeStore.setState(previousModes)
      vi.unstubAllGlobals()
    }
  })


})
