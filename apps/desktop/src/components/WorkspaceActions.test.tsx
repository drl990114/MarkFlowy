import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clearRecentWorkspaces: vi.fn(),
  openFolder: vi.fn(),
  openFolderDialog: vi.fn(),
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
  }),
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'file.clearRecent': 'Clear Recent',
        'file.openDir': 'Open Folder',
        'file.openFolderModal.currentWindow': 'Current Window',
        'file.recentDir': 'Recently opened folders',
        'search.search_empty': 'No matching workspaces',
        'welcome.recentWorkspaces': 'Recent Workspaces',
        'workspace.searchPlaceholder': 'Search workspaces…',
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

import { WorkspaceActions } from './WorkspaceActions'

describe('WorkspaceActions', () => {
  beforeEach(() => {
    mocks.clearRecentWorkspaces.mockReset()
    mocks.clearRecentWorkspaces.mockResolvedValue(undefined)
    mocks.openFolder.mockReset()
    mocks.openFolder.mockResolvedValue(undefined)
    mocks.openFolderDialog.mockReset()
    mocks.openFolderDialog.mockResolvedValue(undefined)
    mocks.recentWorkspaces = [
      { path: '/Users/test/current' },
      { path: '/Users/test/notes' },
      { path: '/Users/test/research' },
    ]
    mocks.rootPath = '/Users/test/current'
  })

  afterEach(cleanup)

  it('uses the workspace name as the single icon-free picker trigger', () => {
    const { container } = render(<WorkspaceActions />)

    const trigger = screen.getByRole('combobox', { name: /current/ })
    expect(trigger.getAttribute('title')).toBe('/Users/test/current')
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(container.querySelector('[data-lucide*="folder"]')).toBeNull()

    fireEvent.click(trigger)
    expect(screen.getByPlaceholderText('Search workspaces…')).toBeTruthy()
    expect(document.querySelector('[data-slot="popover-content"]')?.className).toContain(
      'overflow-hidden',
    )
    expect(screen.getByText('Current Window')).toBeTruthy()
    expect(screen.getByText('Recent Workspaces')).toBeTruthy()
    expect(screen.getAllByText('current')).toHaveLength(2)
  })

  it('opens the folder picker from the merged popover before a workspace is selected', () => {
    mocks.rootPath = ''
    render(<WorkspaceActions />)

    fireEvent.click(screen.getByRole('combobox', { name: /Open Folder/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }))

    expect(mocks.openFolderDialog).toHaveBeenCalledOnce()
  })

  it('opens a recent workspace through the standard folder-opening flow', () => {
    render(<WorkspaceActions />)

    fireEvent.click(screen.getByRole('combobox', { name: /current/ }))
    fireEvent.change(screen.getByPlaceholderText('Search workspaces…'), {
      target: { value: 'research' },
    })
    fireEvent.click(screen.getByText('research'))

    expect(mocks.openFolder).toHaveBeenCalledWith('/Users/test/research')
  })

  it('clears recent workspaces while keeping the picker available', () => {
    const { rerender } = render(<WorkspaceActions />)

    fireEvent.click(screen.getByRole('combobox', { name: /current/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear Recent' }))
    expect(mocks.clearRecentWorkspaces).toHaveBeenCalledOnce()

    mocks.recentWorkspaces = []
    rerender(<WorkspaceActions />)
    expect((screen.getByRole('combobox', { name: /current/ }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })
})
