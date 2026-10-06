import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  openBookmark: vi.fn(),
  showContextMenu: vi.fn(),
  toast: vi.fn(),
  language: 'en',
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('./actions', () => ({ openBookmark: mocks.openBookmark }))
vi.mock('@/components/ui-v2/ContextMenu/ContextMenu', () => ({
  showContextMenu: mocks.showContextMenu,
}))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    i18n: { language: mocks.language },
    t: (key: string, options?: { title?: string }) =>
      key === 'bookmarks.removed' ? `${options?.title} removed` : key,
  }),
}))
vi.mock('zens', () => ({ toast: mocks.toast }))

import { BookMarksList } from '.'
import { BOOKMARK_UNDO_DURATION_MS, useBookmarkStore } from './store'
import type { Bookmark } from './types'
import { useBookmarkViewStore } from './viewStore'

const bookmark: Bookmark = {
  id: 'bookmark-1',
  target: { kind: 'localFile', path: '/workspace/notes.md' },
  tags: [],
  title: 'Project notes',
  createdAt: 1,
}

function resetStore() {
  Object.values(useBookmarkStore.getState().pendingRemovals).forEach(({ timeoutId }) => {
    clearTimeout(timeoutId)
  })
  useBookmarkStore.setState({
    library: { schemaVersion: 1, revision: 0, items: [] },
    loadError: null,
    loadStatus: 'idle',
    migrationWarning: null,
    mutationError: null,
    pendingRemovals: {},
  })
  useBookmarkViewStore.setState({
    config: { groupBy: 'none', sort: { field: 'title', direction: 'asc' } },
    expandedGroupIds: [],
  })
}

function showItems(items: Bookmark[]) {
  useBookmarkStore.setState({
    library: { schemaVersion: 1, revision: 1, items },
    loadStatus: 'ready',
  })
}

function renderList() {
  return render(
    <ThemeProvider theme={desktopLightTheme}>
      <TooltipProvider>
        <BookMarksList />
      </TooltipProvider>
    </ThemeProvider>,
  )
}

function visibleTitles() {
  return [...document.querySelectorAll('[data-bookmark-id]')].map((item) => item.getAttribute('aria-label'))
}

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.showContextMenu.mockReset()
  mocks.toast.mockReset()
  mocks.openBookmark.mockReset()
  mocks.language = 'en'
  resetStore()
})

afterEach(() => {
  cleanup()
  resetStore()
})

describe('BookMarksList states', () => {
  it('keeps list and tag views reachable and includes untagged bookmarks', () => {
    showItems([
      { ...bookmark, tags: ['work'] },
      { ...bookmark, id: 'untagged-note', title: 'Other note' },
    ])
    renderList()

    fireEvent.click(screen.getByRole('button', { name: 'bookmarks.viewByTags' }))
    expect(screen.getByRole('button', { name: 'bookmarks.viewAsList' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'work' }))
    fireEvent.click(screen.getByRole('button', { name: 'bookmarks.untagged' }))
    expect(visibleTitles()).toEqual(['Project notes', 'Other note'])
    expect(useBookmarkViewStore.getState().expandedGroupIds).toEqual(['tag:work', 'untagged'])
    fireEvent.click(screen.getByRole('button', { name: 'Other note' }))
    expect(mocks.openBookmark).toHaveBeenCalledWith(expect.objectContaining({ id: 'untagged-note' }))
  })

  it('announces loading and load failures and exposes retry', async () => {
    useBookmarkStore.setState({ loadStatus: 'loading' })
    const view = renderList()
    expect(screen.getByRole('status').textContent).toContain('bookmarks.loading')

    view.unmount()
    useBookmarkStore.setState({ loadError: 'permission denied', loadStatus: 'error' })
    mocks.invoke.mockResolvedValueOnce({
      library: { schemaVersion: 1, revision: 1, items: [] },
      warning: null,
    })
    renderList()
    expect(screen.getByRole('alert').textContent).toContain('bookmarks.loadError')
    fireEvent.click(screen.getByRole('button', { name: 'bookmarks.retry' }))
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('get_bookmark_library'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('bookmarks.empty'))
  })

  it('announces the empty state in either grouping mode', () => {
    showItems([])
    renderList()
    expect(screen.getByRole('status').textContent).toContain('bookmarks.empty')
    fireEvent.click(screen.getByRole('button', { name: 'bookmarks.viewByTags' }))
    expect(screen.getByRole('status').textContent).toContain('bookmarks.empty')
  })
})

describe('BookMarksList sorting', () => {
  it('offers four radio choices and applies the same ordering inside tag groups', async () => {
    const user = userEvent.setup()
    const source = [
      { ...bookmark, id: 'z', title: 'Zulu', tags: ['work'], createdAt: 1 },
      { ...bookmark, id: 'a', title: 'Alpha', tags: ['work'], createdAt: 3 },
      { ...bookmark, id: 'b', title: 'Beta', tags: ['work'], createdAt: 2 },
    ]
    showItems(source)
    renderList()
    expect(visibleTitles()).toEqual(['Alpha', 'Beta', 'Zulu'])
    const trigger = screen.getByRole('button', { name: 'bookmarks.sort' })
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findAllByRole('menuitemradio')).toHaveLength(4)
    expect(screen.getByRole('menuitemradio', { name: 'bookmarks.sortNameAsc' }).getAttribute('aria-checked')).toBe('true')
    await user.click(screen.getByRole('menuitemradio', { name: 'bookmarks.sortNameDesc' }))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(visibleTitles()).toEqual(['Zulu', 'Beta', 'Alpha'])
    await waitFor(() => expect(document.activeElement).toBe(trigger))

    await user.click(trigger)
    await user.click(screen.getByRole('menuitemradio', { name: 'bookmarks.sortNewest' }))
    expect(visibleTitles()).toEqual(['Alpha', 'Beta', 'Zulu'])
    fireEvent.click(screen.getByRole('button', { name: 'bookmarks.viewByTags' }))
    fireEvent.click(screen.getByRole('button', { name: 'work' }))
    expect(visibleTitles()).toEqual(['Alpha', 'Beta', 'Zulu'])
    expect(useBookmarkStore.getState().library.items).toEqual(source)
    await user.click(trigger)
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('preserves an untagged group when the locale changes', () => {
    showItems([bookmark])
    const view = renderList()
    fireEvent.click(screen.getByRole('button', { name: 'bookmarks.viewByTags' }))
    fireEvent.click(screen.getByRole('button', { name: 'bookmarks.untagged' }))
    mocks.language = 'frFR'
    view.rerender(
      <ThemeProvider theme={desktopLightTheme}>
        <TooltipProvider><BookMarksList /></TooltipProvider>
      </ThemeProvider>,
    )
    expect(screen.getByRole('button', { name: 'bookmarks.untagged' }).getAttribute('aria-expanded')).toBe('true')
    expect(visibleTitles()).toEqual(['Project notes'])
  })
})

describe('BookMarksList removal', () => {
  it('offers a five-second toast action that restores the removed bookmark', () => {
    showItems([bookmark])
    renderList()

    fireEvent.contextMenu(screen.getByRole('button', { name: bookmark.title }))
    const contextMenu = mocks.showContextMenu.mock.calls[0]?.[0] as
      | { items: { handler?: () => void; value: string }[] }
      | undefined
    act(() => contextMenu?.items.find((item) => item.value === 'remove')?.handler?.())

    expect(visibleTitles()).toEqual([])
    expect(useBookmarkStore.getState().library.items).toEqual([bookmark])
    expect(mocks.toast).toHaveBeenCalledTimes(1)
    const toastOptions = mocks.toast.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void }; duration?: number }
      | undefined
    expect(toastOptions?.duration).toBe(BOOKMARK_UNDO_DURATION_MS)
    act(() => toastOptions?.action?.onClick())
    expect(visibleTitles()).toEqual(['Project notes'])
  })
})
