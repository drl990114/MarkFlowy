import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { commandRegistry } from '@/commands'
import { TooltipProvider } from '@/components/ui/tooltip'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { BookMarkDialog } from './BookMarkDialog'
import { loadBookmarkLibrary, useBookmarkStore } from './store'
import type { Bookmark, BookmarkLibrary, BookmarkLibraryResult } from './types'

const bookmark: Bookmark = {
  id: 'bookmark-1',
  title: 'Saved title',
  target: { kind: 'localFile', path: '/workspace/notes.md' },
  tags: ['work'],
  createdAt: 100,
}

function library(items: Bookmark[] = [bookmark], revision = 7): BookmarkLibrary {
  return { schemaVersion: 1, revision, items }
}

function renderDialog() {
  return render(
    <ThemeProvider theme={desktopLightTheme}>
      <TooltipProvider><BookMarkDialog /></TooltipProvider>
    </ThemeProvider>,
  )
}

async function openEdit() {
  await act(() => commandRegistry.execute('edit_bookmark_dialog', bookmark))
}

beforeEach(() => {
  mocks.invoke.mockReset()
  useBookmarkStore.setState({
    library: library(),
    loadStatus: 'ready',
    loadError: null,
    migrationWarning: null,
    pendingRemovals: {},
    mutationError: null,
  })
})
afterEach(cleanup)

describe('BookMarkDialog revision conflicts', () => {
  it('waits for a newer startup read before making the draft editable', async () => {
    let finishFirst: (value: BookmarkLibraryResult) => void = () => undefined
    let finishSecond: (value: BookmarkLibraryResult) => void = () => undefined
    mocks.invoke
      .mockImplementationOnce(() => new Promise<BookmarkLibraryResult>((resolve) => {
        finishFirst = resolve
      }))
      .mockImplementationOnce(() => new Promise<BookmarkLibraryResult>((resolve) => {
        finishSecond = resolve
      }))
    useBookmarkStore.setState({ library: library([], 0), loadStatus: 'idle' })
    renderDialog()
    let opening: Promise<unknown> = Promise.resolve()
    let newerLoad: Promise<void> = Promise.resolve()
    act(() => {
      opening = commandRegistry.execute('edit_bookmark_dialog', bookmark)
    })
    act(() => {
      newerLoad = loadBookmarkLibrary()
    })
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'get_bookmark_library')
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'get_bookmark_library')
    await act(async () => finishFirst({ library: library(), warning: null }))

    const latestBookmark = { ...bookmark, title: 'Latest title' }
    try {
      expect(screen.queryByRole('alert')).toBeNull()
      expect((screen.getByRole('button', { name: 'bookmarks.loading' }) as HTMLButtonElement).disabled).toBe(true)
      expect((screen.getByRole('textbox', { name: 'bookmarks.name' }) as HTMLInputElement).disabled).toBe(true)
    } finally {
      await act(async () => {
        finishSecond({ library: library([latestBookmark], 8), warning: null })
        await Promise.all([opening, newerLoad])
      })
    }

    expect(screen.queryByRole('alert')).toBeNull()
    expect((screen.getByRole('textbox', { name: 'bookmarks.name' }) as HTMLInputElement).value).toBe('Latest title')
    expect((screen.getByRole('button', { name: 'common.confirm' }) as HTMLButtonElement).disabled).toBe(false)
    mocks.invoke.mockResolvedValueOnce(library([latestBookmark], 9))
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.invoke).toHaveBeenLastCalledWith('mutate_bookmark_library', {
      expectedRevision: 8,
      mutation: { type: 'update', id: bookmark.id, changes: { title: 'Latest title', tags: ['work'] } },
    })
  })

  it('keeps the opening revision and draft until the user explicitly reloads', async () => {
    renderDialog()
    await openEdit()
    fireEvent.change(screen.getByRole('textbox', { name: 'bookmarks.name' }), { target: { value: 'My draft' } })
    const remote = { ...bookmark, title: 'Remote update', tags: ['remote'] }
    act(() => useBookmarkStore.setState({ library: library([remote], 8) }))
    mocks.invoke.mockRejectedValueOnce({ code: 'conflict', message: 'Revision changed' })
    mocks.invoke.mockResolvedValueOnce({ library: library([remote], 8), warning: null })
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('bookmarks.saveConflict'))
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'mutate_bookmark_library', {
      expectedRevision: 7,
      mutation: { type: 'update', id: bookmark.id, changes: { title: 'My draft', tags: ['work'] } },
    })
    expect((screen.getByRole('textbox', { name: 'bookmarks.name' }) as HTMLInputElement).value).toBe('My draft')
    expect((screen.getByRole('button', { name: 'common.confirm' }) as HTMLButtonElement).disabled).toBe(true)
    mocks.invoke.mockResolvedValueOnce({ library: library([remote], 8), warning: null })
    fireEvent.click(screen.getByRole('button', { name: 'bookmarks.reloadBookmark' }))
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'bookmarks.name' }) as HTMLInputElement).value).toBe('Remote update'))
    expect(screen.queryByRole('alert')).toBeNull()

    mocks.invoke.mockResolvedValueOnce(library([remote], 9))
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.invoke).toHaveBeenLastCalledWith('mutate_bookmark_library', {
      expectedRevision: 8,
      mutation: { type: 'update', id: bookmark.id, changes: { title: 'Remote update', tags: ['remote'] } },
    })
  })

  it('keeps a deleted bookmark draft visible without recreating the bookmark', async () => {
    renderDialog()
    await openEdit()
    fireEvent.change(screen.getByRole('textbox', { name: 'bookmarks.name' }), { target: { value: 'Unsent draft' } })
    mocks.invoke.mockRejectedValueOnce({ code: 'conflict', message: 'Deleted elsewhere' })
    mocks.invoke.mockResolvedValueOnce({ library: library([], 8), warning: null })
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    await screen.findByText('bookmarks.saveConflict')
    mocks.invoke.mockResolvedValueOnce({ library: library([], 8), warning: null })
    fireEvent.click(screen.getByRole('button', { name: 'bookmarks.reloadBookmark' }))
    await screen.findByText('bookmarks.noLongerExists')
    expect((screen.getByRole('textbox', { name: 'bookmarks.name' }) as HTMLInputElement).value).toBe('Unsent draft')
    expect((screen.getByRole('button', { name: 'common.confirm' }) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.invoke.mock.calls.filter(([command]) => command === 'mutate_bookmark_library')).toHaveLength(1)
  })

  it('keeps a new bookmark draft during explicit reload and sends the typed target', async () => {
    renderDialog()
    await act(() => commandRegistry.execute('open_bookmark_dialog', { path: '/workspace/new.md', name: 'New note' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'bookmarks.name' }), { target: { value: 'New draft' } })
    mocks.invoke.mockRejectedValueOnce({ code: 'conflict', message: 'Changed elsewhere' })
    mocks.invoke.mockResolvedValueOnce({ library: library([bookmark], 8), warning: null })
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    await screen.findByText('bookmarks.saveConflict')
    mocks.invoke.mockResolvedValueOnce({ library: library([bookmark], 8), warning: null })
    fireEvent.click(screen.getByRole('button', { name: 'bookmarks.reloadLibrary' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect((screen.getByRole('textbox', { name: 'bookmarks.name' }) as HTMLInputElement).value).toBe('New draft')
    mocks.invoke.mockResolvedValueOnce(library([bookmark], 9))
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.invoke).toHaveBeenLastCalledWith('mutate_bookmark_library', {
      expectedRevision: 8,
      mutation: { type: 'create', input: { title: 'New draft', target: { kind: 'localFile', path: '/workspace/new.md' }, tags: [] } },
    })
  })

  it('does not close a newer dialog when an earlier save finishes', async () => {
    let finishSave: (value: BookmarkLibrary) => void = () => undefined
    mocks.invoke.mockImplementationOnce(() => new Promise<BookmarkLibrary>((resolve) => {
      finishSave = resolve
    }))
    renderDialog()
    await openEdit()
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
    await act(() => commandRegistry.execute('open_bookmark_dialog', {
      path: '/workspace/other.md',
      name: 'Another bookmark',
    }))
    await act(async () => finishSave(library([bookmark], 8)))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'bookmarks.name' }) as HTMLInputElement).value).toBe('Another bookmark')
    expect((screen.getByRole('button', { name: 'common.confirm' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
