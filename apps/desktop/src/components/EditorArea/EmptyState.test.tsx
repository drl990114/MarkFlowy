import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EmptyState, getEmptyStateMode } from './EmptyState'

const emptyStateTestState = vi.hoisted(() => ({
  addNewFile: vi.fn(),
  openFile: vi.fn(),
  openFolder: vi.fn(),
  rootPath: undefined as string | undefined,
}))

vi.mock('@/commands', () => ({
  keybindingRegistry: {
    formatKeybinding: () => '⌘O',
  },
}))

vi.mock('@/hooks', () => ({
  useOpen: () => ({
    openFile: emptyStateTestState.openFile,
    openFolderDialog: emptyStateTestState.openFolder,
  }),
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'action.create_file': 'New File',
        'file.emptyOpened': 'No files open',
        'file.openDir': 'Open Folder',
        'file.openFile': 'Open File',
        'welcome.getStarted': 'Get Started',
        'workspace.none': 'Workspace is not open',
      })[key] ?? key,
  }),
}))

vi.mock('@/services/editor-file', () => ({
  addNewMarkdownFileEdit: emptyStateTestState.addNewFile,
}))

vi.mock('@/stores', () => ({
  useEditorStore: (selector: (state: { folderData: { path: string }[] | null }) => unknown) =>
    selector({
      folderData: emptyStateTestState.rootPath
        ? [{ path: emptyStateTestState.rootPath }]
        : null,
    }),
}))

beforeEach(() => {
  emptyStateTestState.rootPath = undefined
  emptyStateTestState.addNewFile.mockReset().mockResolvedValue(undefined)
  emptyStateTestState.openFile.mockReset().mockResolvedValue(undefined)
  emptyStateTestState.openFolder.mockReset().mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('EmptyState', () => {
  it('renders a compact action list without the promotional welcome surface', () => {
    const { container } = render(<EmptyState />)

    expect(screen.getByRole('status').textContent).toContain('Workspace is not open')
    expect(screen.getByRole('group', { name: 'Get Started' })).toBeTruthy()
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByText(/Welcome back/)).toBeNull()
    expect(container.querySelector('[data-testid="markflowy-logo"]')).toBeNull()
    expect(screen.queryByText('Recent Workspaces')).toBeNull()
    expect(screen.getByText('⌘O')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'New File' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open File' }))

    expect(emptyStateTestState.addNewFile).toHaveBeenCalledWith({
      content: '',
      fileName: 'new-file.md',
    })
    expect(emptyStateTestState.openFolder).toHaveBeenCalledOnce()
    expect(emptyStateTestState.openFile).toHaveBeenCalledOnce()
  })

  it('keeps an existing workspace on the same compact empty-state pattern', () => {
    emptyStateTestState.rootPath = '/Users/test/notes'

    render(<EmptyState />)

    expect(screen.getByRole('status').textContent).toContain('No files open')
    expect(screen.getByRole('button', { name: 'New File' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open File' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open Folder' })).toBeNull()
  })
})

describe('empty-state model', () => {
  it('separates no-workspace state from an empty editor', () => {
    expect(getEmptyStateMode()).toBe('no-workspace')
    expect(getEmptyStateMode('/Users/test/notes')).toBe('empty-editor')
  })
})
