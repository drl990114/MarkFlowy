import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { enableMapSet } from 'immer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentTitle } from '@/components/TitleBar/DocumentTitle'
import { TooltipProvider } from '@/components/ui/tooltip'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { guardUnsavedFiles } from '@/services/checkUnsavedFiles'
import {
  addExistingMarkdownFileEdit,
  addNewMarkdownFileEdit,
  ensureDocument,
} from '@/services/editor-file'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorStore from '@/stores/useEditorStore'
import useLayoutStore from '@/stores/useLayoutStore'
import Root from '.'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => false }))
vi.mock('@/commands', () => ({
  commandRegistry: { registerCommand: () => ({ dispose: () => {} }) },
}))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  t: (key: string) => key,
  i18n: { t: (key: string) => key },
}))
vi.mock('@/services/checkUnsavedFiles', () => ({ guardUnsavedFiles: vi.fn() }))
vi.mock('@/services/rename-document', () => ({
  renameDocument: vi.fn(),
  RenameDocumentError: class extends Error {},
}))
vi.mock('@/components/SideBar', () => ({ default: () => null }))
vi.mock('@/components/SideBar/RightBar', () => ({ default: () => null }))
vi.mock('@/components/SideBar/DockSwitcher', () => ({ scheduleDockFocus: vi.fn() }))
vi.mock('@/components/EditorArea', () => ({ default: () => null }))
vi.mock('@/components/EditorArea/focusActiveEditor', () => ({
  scheduleActiveEditorFocus: vi.fn(),
}))
vi.mock('@/components/StatusBar', () => ({ default: () => null }))
vi.mock('@/components/WorkspaceOpenError', () => ({ WorkspaceOpenError: () => null }))
vi.mock('@/extensions/bookmarks/BookMarkDialog', () => ({ BookMarkDialog: () => null }))
vi.mock('@/extensions/bookmarks/useBookMarksStore', () => ({
  default: () => ({ getBookMarkList: vi.fn() }),
}))
vi.mock('@/extensions/quick-open/QuickOpenDialog', () => ({ QuickOpenDialog: () => null }))
vi.mock('@/extensions/command-palette/CommandPaletteDialog', () => ({
  CommandPaletteDialog: () => null,
}))
vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))
vi.mock('./styles', () => ({
  RootPageLayout: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSeparator: () => null,
}))
vi.mock('./ZenModeHint', () => ({ ZenModeHint: () => null }))

enableMapSet()

beforeEach(() => {
  vi.clearAllMocks()
  useEditorStore.getState().setFolderData(null)
  useFileCacheStore.setState({
    entries: {},
    contentEntries: {},
    pathEntries: {},
    metadataRevision: 0,
  })
  useEditorStateStore.setState({ idStateMap: new Map() })
  useLayoutStore.setState({ zenModeActive: false })
  vi.mocked(guardUnsavedFiles).mockImplementation(({ onContinue }) => {
    void onContinue()
    return 0
  })
})

afterEach(cleanup)

function renderDocumentWindow() {
  return render(
    <TooltipProvider>
      <DocumentTitle />
      <Root />
    </TooltipProvider>,
  )
}

async function closeDocument() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'file.closeDocument' }))
  })
}

function expectNoDocument() {
  expect(useEditorStore.getState().opened).toEqual([])
  expect(useEditorStore.getState().activeId).toBeUndefined()
  expect(screen.queryByRole('button', { name: 'file.closeDocument' })).toBeNull()
}

describe('closing the last document without a workspace', () => {
  it.each(['untitled', 'saved'] as const)(
    'keeps the editor empty after closing a clean %s document',
    async (kind) => {
      if (kind === 'untitled') ensureDocument()
      else await addExistingMarkdownFileEdit({ fileName: 'note.md', path: '/notes/note.md' })
      const id = useEditorStore.getState().activeId!
      const groupId = useEditorStore.getState().activeGroupId
      renderDocumentWindow()

      await closeDocument()

      expect(guardUnsavedFiles).toHaveBeenCalledWith({
        fileIds: [id],
        onContinue: expect.any(Function),
      })
      expectNoDocument()
      await act(async () => useEditorStore.getState().setActiveGroupId(groupId!))
      expectNoDocument()
    },
  )

  it('retains a dirty document until the unsaved-file guard continues, then leaves it closed', async () => {
    await addNewMarkdownFileEdit({ fileName: 'draft.md', content: 'Keep this text' })
    const id = useEditorStore.getState().activeId!
    vi.mocked(guardUnsavedFiles).mockReturnValue(1)
    renderDocumentWindow()

    // Cancelling the guard never runs its continuation.
    await closeDocument()
    expect(useEditorStore.getState().opened).toEqual([id])
    expect(getFileObject(id)?.content).toBe('Keep this text')
    await closeDocument()
    await act(async () => {
      await vi.mocked(guardUnsavedFiles).mock.calls[1][0].onContinue()
    })

    expectNoDocument()
  })

  it('preserves an empty editor on remount and allows explicit new and open actions', async () => {
    ensureDocument()
    const window = renderDocumentWindow()
    await closeDocument()
    window.unmount()
    await act(async () => {
      renderDocumentWindow()
    })
    expectNoDocument()

    await act(async () => {
      await addNewMarkdownFileEdit({ fileName: 'manual.md', content: '' })
    })
    expect(useEditorStore.getState().opened).toHaveLength(1)
    expect(getFileObject(useEditorStore.getState().activeId!)?.name).toBe('manual.md')
    await closeDocument()
    expectNoDocument()

    await act(async () => {
      await addExistingMarkdownFileEdit({ fileName: 'opened.md', path: '/notes/opened.md' })
    })
    expect(useEditorStore.getState().opened).toHaveLength(1)
    expect(getFileObject(useEditorStore.getState().activeId!)?.path).toBe('/notes/opened.md')
  })
})
