import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useRecentFilesStore from '@/stores/useRecentFilesStore'

const mocks = vi.hoisted(() => ({
  clearRecentWorkspaces: vi.fn(),
  openFolder: vi.fn(),
  openFolderDialog: vi.fn(),
  openFile: vi.fn(),
  openFilePath: vi.fn(),
  closeFolder: vi.fn(),
  toastError: vi.fn(),
  recentWorkspaces: [
    { path: '/Users/test/notes' },
    { path: '/Users/test/research' },
  ],
  rootPath: '/Users/test/current',
}))

vi.mock('@/hooks/useOpen', () => ({
  default: () => ({
    openFolder: mocks.openFolder,
    openFolderDialog: mocks.openFolderDialog,
    openFile: mocks.openFile,
    openFilePath: mocks.openFilePath,
    closeFolder: mocks.closeFolder,
  }),
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'file.clearRecent': 'Clear Recent',
        'file.openDir': 'Open Folder',
        'file.openFile': 'Open a File',
        'file.openFolderInNewWindow': 'Open Folder in New Window',
        'file.closeFolder': 'Close Folder',
        'file.openFolderModal.currentWindow': 'Current Window',
        'file.recentDir': 'Recently opened folders',
        'search.search_empty': 'No matches',
        'welcome.recentWorkspaces': 'Recent Workspaces',
        'workspace.openFileOrFolder': 'Open File or Folder',
        'workspace.recentFiles': 'Recent Files',
        'workspace.searchPlaceholder': 'Search recent workspaces and files…',
      })[key] ?? key,
  }),
}))

vi.mock('@/stores', () => ({
  useEditorStore: (selector: (state: { folderData: { path: string }[] }) => unknown) =>
    selector({ folderData: mocks.rootPath ? [{ path: mocks.rootPath }] : [] }),
}))

vi.mock('@/stores/useOpenedCacheStore', () => ({
  default: (selector: (state: unknown) => unknown) =>
    selector({
      clearRecentWorkspaces: mocks.clearRecentWorkspaces,
      recentWorkspaces: mocks.recentWorkspaces,
    }),
}))

vi.mock('zens', () => ({ toast: { error: mocks.toastError } }))

import { WorkspaceActions } from './WorkspaceActions'

const openPicker = () => fireEvent.click(screen.getByRole('button', { name: 'Open File or Folder' }))
const searchInput = () => screen.getByPlaceholderText('Search recent workspaces and files…')

describe('WorkspaceActions', () => {
  beforeEach(() => {
    mocks.clearRecentWorkspaces.mockReset()
    mocks.clearRecentWorkspaces.mockResolvedValue(undefined)
    mocks.openFolder.mockReset()
    mocks.openFolder.mockResolvedValue(undefined)
    mocks.openFolderDialog.mockReset()
    mocks.openFolderDialog.mockResolvedValue(undefined)
    mocks.openFile.mockReset().mockResolvedValue(undefined)
    mocks.openFilePath.mockReset().mockResolvedValue(undefined)
    mocks.closeFolder.mockReset().mockResolvedValue(true)
    mocks.toastError.mockReset()
    useRecentFilesStore.setState({ entries: [], restoring: false })
    useRecentFilesStore.getState().replaceEntries([
      { path: '/Users/test/notes/latest.md' },
      { path: '/Users/test/notes/earlier.md' },
    ])
    mocks.recentWorkspaces = [
      { path: '/Users/test/current' },
      { path: '/Users/test/notes' },
      { path: '/Users/test/research' },
    ]
    mocks.rootPath = '/Users/test/current'
  })

  afterEach(cleanup)

  it('uses a single named icon button and shows the current workspace inside the picker', () => {
    const { container } = render(<WorkspaceActions />)

    const trigger = screen.getByRole('button', { name: 'Open File or Folder' })
    expect(trigger.getAttribute('title')).toBe('Open File or Folder\n/Users/test/current')
    expect(trigger.textContent).toBe('')
    expect(trigger.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-slot="workspace-picker-trigger"]')).toHaveLength(1)

    fireEvent.click(trigger)
    expect(searchInput()).toBeTruthy()
    expect(document.querySelector('[data-slot="popover-content"]')?.className).toContain(
      'overflow-hidden',
    )
    expect(screen.getByText('Current Window')).toBeTruthy()
    expect(screen.getByText('Recent Workspaces')).toBeTruthy()
    expect(screen.getByText('Recent Files')).toBeTruthy()
    expect(screen.getAllByText('current')).toHaveLength(1)
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('data-value'))).toEqual([
      'current:/Users/test/current',
      'recent:/Users/test/notes',
      'recent:/Users/test/research',
      'file:/Users/test/notes/latest.md',
      'file:/Users/test/notes/earlier.md',
    ])
  })

  it('opens the folder picker from the merged popover before a workspace is selected', () => {
    mocks.rootPath = ''
    render(<WorkspaceActions />)

    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }))

    expect(mocks.openFolderDialog).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens a file without requiring a workspace', () => {
    mocks.rootPath = ''
    render(<WorkspaceActions />)

    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Open a File' }))

    expect(mocks.openFile).toHaveBeenCalledOnce()
    expect(mocks.openFolderDialog).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens a recent workspace through the standard folder-opening flow', () => {
    render(<WorkspaceActions />)

    openPicker()
    fireEvent.change(searchInput(), {
      target: { value: 'research' },
    })
    fireEvent.click(screen.getByText('research'))

    expect(mocks.openFolder).toHaveBeenCalledWith('/Users/test/research')
  })

  it('searches recent files by path and opens the keyboard selection in the current window', async () => {
    mocks.rootPath = ''
    render(<WorkspaceActions />)

    openPicker()
    fireEvent.change(searchInput(), { target: { value: 'notes/earlier' } })
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
    fireEvent.keyDown(searchInput(), { key: 'Enter' })

    expect(mocks.openFilePath).toHaveBeenCalledWith('/Users/test/notes/earlier.md')
    expect(mocks.openFile).not.toHaveBeenCalled()
    expect(mocks.openFolder).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not select a recent item when pressing Enter on a footer action', () => {
    render(<WorkspaceActions />)
    openPicker()

    const openFile = screen.getByRole('button', { name: 'Open a File' })
    fireEvent.keyDown(openFile, { key: 'Enter' })
    fireEvent.click(openFile)

    expect(mocks.openFile).toHaveBeenCalledOnce()
    expect(mocks.openFilePath).not.toHaveBeenCalled()
    expect(mocks.openFolder).not.toHaveBeenCalled()
  })

  it('omits pathless drafts and preserves the deduplicated recent-file order', () => {
    useRecentFilesStore.getState().replaceEntries([
      { fileId: 'unsaved-draft' },
      { path: 'C:\\Notes\\latest.md' },
      { path: 'c:/notes/latest.md' },
      { path: '/Users/test/notes/earlier.md' },
    ])
    render(<WorkspaceActions />)
    openPicker()

    expect(
      screen.getAllByRole('option')
        .map((option) => option.getAttribute('data-value'))
        .filter((value) => value?.startsWith('file:')),
    ).toEqual([
      'file:C:\\Notes\\latest.md',
      'file:/Users/test/notes/earlier.md',
    ])
  })

  it('keeps both open actions available when history is empty or the query has no matches', () => {
    mocks.rootPath = ''
    mocks.recentWorkspaces = []
    useRecentFilesStore.getState().replaceEntries([])
    render(<WorkspaceActions />)
    openPicker()

    fireEvent.change(searchInput(), { target: { value: 'unknown' } })
    expect(screen.getByText('No matches')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open a File' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open Folder' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Clear Recent' })).toBeNull()
  })

  it('reports file-opening failures', async () => {
    mocks.openFilePath.mockRejectedValue(new Error('Cannot open file'))
    render(<WorkspaceActions />)
    openPicker()
    fireEvent.click(screen.getByText('latest.md'))

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Error: Cannot open file'))
  })

  it('clears both recent workspaces and recent files while keeping the picker available', () => {
    const { rerender } = render(<WorkspaceActions />)

    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Clear Recent' }))
    expect(mocks.clearRecentWorkspaces).toHaveBeenCalledOnce()
    expect(useRecentFilesStore.getState().entries).toEqual([])

    mocks.recentWorkspaces = []
    rerender(<WorkspaceActions />)
    const trigger = screen.getByRole('button', { name: 'Open File or Folder' }) as HTMLButtonElement
    expect(trigger.disabled).toBe(false)
  })

  it('can clear file history when no recent workspaces remain', () => {
    mocks.recentWorkspaces = []
    render(<WorkspaceActions />)
    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Clear Recent' }))

    expect(useRecentFilesStore.getState().entries).toEqual([])
  })

  it('keeps the same icon entry available in the Linux status bar', () => {
    render(<WorkspaceActions location='statusbar' />)
    const trigger = screen.getByRole('button', { name: 'Open File or Folder' })
    expect(trigger.getAttribute('data-mf-status-bar-format')).toBe('icon')
    openPicker()
    expect(screen.getByRole('button', { name: 'Open a File' })).toBeTruthy()
  })
})
