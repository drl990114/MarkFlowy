import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { enableMapSet } from 'immer'
import type * as InterfaceModule from '@markflowy/interface'
import type * as RenameDocumentModule from '@/services/rename-document'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createFile, updateFile } from '@/helper/filesys'
import { guardUnsavedFiles } from '@/services/checkUnsavedFiles'
import { renameDocument, RenameDocumentError } from '@/services/rename-document'
import useEditorStateStore from '@/stores/useEditorStateStore'
import useEditorStore from '@/stores/useEditorStore'
import { DocumentTitle } from './DocumentTitle'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => false }))
vi.mock('@markflowy/interface', async (importOriginal) => ({
  ...(await importOriginal<typeof InterfaceModule>()),
  useFileSystem: () => ({}),
}))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  t: (key: string) => key,
  i18n: { t: (key: string) => key },
}))
vi.mock('@/services/rename-document', async (importOriginal) => ({
  ...(await importOriginal<typeof RenameDocumentModule>()),
  renameDocument: vi.fn(),
}))
vi.mock('@/services/checkUnsavedFiles', () => ({ guardUnsavedFiles: vi.fn() }))

enableMapSet()

beforeEach(() => {
  vi.clearAllMocks()
  useEditorStore.getState().setFolderData(null)
  useEditorStateStore.setState({ idStateMap: new Map() })
  createFile({ id: 'document', name: 'My note.md', path: '/notes/My note.md' })
  useEditorStore
    .getState()
    .setEditorLayout(
      { type: 'leaf', id: 'group', opened: ['document'], activeId: 'document' },
      'group',
    )
  vi.mocked(renameDocument).mockResolvedValue('renamed')
})
afterEach(cleanup)

function renderTitle() {
  return render(
    <TooltipProvider>
      <DocumentTitle />
      <button type='button'>Editor focus target</button>
    </TooltipProvider>,
  )
}

function startRename() {
  fireEvent.click(screen.getByRole('button', { name: 'contextmenu.explorer.rename: My note.md' }))
  return screen.getByRole('textbox', { name: 'contextmenu.explorer.rename' }) as HTMLInputElement
}

describe('DocumentTitle', () => {
  it('groups rename and close beside the dirty title without making controls draggable', () => {
    useEditorStateStore.getState().setIdStateMap('document', { hasUnsavedChanges: true })
    renderTitle()
    const title = screen.getByTitle('/notes/My note.md')
    expect(within(title).getByText('•')).toBeTruthy()
    expect(within(title).getByRole('button', { name: /contextmenu.explorer.rename/ })).toBeTruthy()
    expect(within(title).getByRole('button', { name: 'file.closeDocument' })).toBeTruthy()
    expect(title.querySelector('[data-tauri-drag-region]')).toBeNull()
    expect(title.hasAttribute('data-tauri-drag-region')).toBe(false)
  })

  it('selects the basename, commits on Enter and restores keyboard focus to the new title', async () => {
    vi.mocked(renameDocument).mockImplementation(async (target, name) => {
      updateFile({ id: target.id, name, path: `/notes/${name}` })
      return 'renamed'
    })
    renderTitle()
    const input = startRename()
    expect(document.activeElement).toBe(input)
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 7])
    fireEvent.change(input, { target: { value: 'New title.md' } })
    await act(async () => fireEvent.keyDown(input, { key: 'Enter' }))
    expect(renameDocument).toHaveBeenCalledWith(
      { id: 'document', path: '/notes/My note.md', name: 'My note.md' },
      'New title.md',
      expect.anything(),
    )
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'contextmenu.explorer.rename: New title.md' }),
    )
    expect(useEditorStore.getState().activeId).toBe('document')
  })

  it('cancels Escape without submitting the edited name', async () => {
    renderTitle()
    const input = startRename()
    fireEvent.change(input, { target: { value: 'Cancelled.md' } })
    await act(async () => fireEvent.keyDown(input, { key: 'Escape' }))
    expect(renameDocument).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'contextmenu.explorer.rename: My note.md' }),
    )
  })

  it('does not submit or cancel while a name is being composed with an IME', async () => {
    renderTitle()
    const input = startRename()
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '笔记.md' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
      fireEvent.keyDown(input, { key: 'Escape', isComposing: true })
    })
    expect(renameDocument).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toBe(input)
    fireEvent.compositionEnd(input)
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    expect(renameDocument).not.toHaveBeenCalled()
    await act(async () => fireEvent.keyDown(input, { key: 'Enter' }))
    expect(renameDocument).toHaveBeenCalledOnce()
  })

  it('commits on blur without taking focus back from the editor', async () => {
    renderTitle()
    const input = startRename()
    fireEvent.change(input, { target: { value: 'New title.md' } })
    const editor = screen.getByRole('button', { name: 'Editor focus target' })
    await act(async () => editor.focus())
    expect(renameDocument).toHaveBeenCalledOnce()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(document.activeElement).toBe(editor)
  })

  it('does not submit twice when Enter and blur occur during a pending rename', async () => {
    let complete: (() => void) | undefined
    vi.mocked(renameDocument).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = () => resolve('renamed')
        }),
    )
    renderTitle()
    const input = startRename()
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
      fireEvent.blur(input)
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(renameDocument).toHaveBeenCalledOnce()
    expect(input.readOnly).toBe(true)
    await act(async () => complete?.())
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('respects focus moved away while an Enter-initiated rename is still pending', async () => {
    let complete: (() => void) | undefined
    vi.mocked(renameDocument).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = () => resolve('renamed')
        }),
    )
    renderTitle()
    const input = startRename()
    fireEvent.keyDown(input, { key: 'Enter' })
    const editor = screen.getByRole('button', { name: 'Editor focus target' })
    act(() => editor.focus())
    await act(async () => complete?.())
    expect(document.activeElement).toBe(editor)
  })

  it('shows a localized conflict and keeps the entered name available for correction', async () => {
    vi.mocked(renameDocument).mockRejectedValueOnce(new RenameDocumentError('exists'))
    renderTitle()
    const input = startRename()
    fireEvent.change(input, { target: { value: 'Existing.md' } })
    await act(async () => fireEvent.keyDown(input, { key: 'Enter' }))
    expect(input.value).toBe('Existing.md')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getAllByRole('alert')[0].textContent).toBe('file.renameErrors.exists')
    fireEvent.change(input, { target: { value: 'Unique.md' } })
    await act(async () => fireEvent.keyDown(input, { key: 'Enter' }))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(renameDocument).toHaveBeenCalledTimes(2)
  })

  it('closes only through the unsaved-file guard for the captured document and group', () => {
    renderTitle()
    fireEvent.click(screen.getByRole('button', { name: 'file.closeDocument' }))
    expect(guardUnsavedFiles).toHaveBeenCalledWith({
      fileIds: ['document'],
      onContinue: expect.any(Function),
    })
    expect(useEditorStore.getState().opened).toEqual(['document'])
    act(() => {
      vi.mocked(guardUnsavedFiles).mock.calls[0][0].onContinue()
    })
    expect(useEditorStore.getState().opened).toEqual([])
  })
})
