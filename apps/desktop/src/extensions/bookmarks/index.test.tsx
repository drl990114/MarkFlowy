import { desktopLightTheme } from '@markflowy/theme'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  showContextMenu: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/components/ui-v2/ContextMenu/ContextMenu', () => ({
  showContextMenu: mocks.showContextMenu,
}))
vi.mock('@/helper/files', () => ({ getFileObjectByPath: vi.fn() }))
vi.mock('@/helper/filesys', () => ({ createFile: vi.fn() }))
vi.mock('@/stores', () => ({
  useEditorStore: {
    getState: () => ({ addOpenedFile: vi.fn(), setActiveId: vi.fn() }),
  },
}))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { title?: string }) =>
      key === 'bookmarks.removed' ? `${options?.title} removed` : key,
  }),
}))
vi.mock('zens', () => ({ toast: mocks.toast }))

import { BookMarksList } from '.'
import useBookMarksStore, {
  BOOKMARK_UNDO_DURATION_MS,
  type BookMarkItem,
} from './useBookMarksStore'

const bookmark: BookMarkItem = {
  id: 'bookmark-1',
  path: '/workspace/notes.md',
  tags: [],
  title: 'Project notes',
}

function resetStore() {
  Object.values(useBookMarksStore.getState().pendingRemovals).forEach(({ timeoutId }) => {
    clearTimeout(timeoutId)
  })
  useBookMarksStore.setState({
    bookMarkList: [],
    failedRemoval: null,
    loadError: null,
    loadStatus: 'idle',
    mutationError: null,
    pendingRemovals: {},
    tagList: [],
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

beforeEach(() => {
  vi.useFakeTimers()
  mocks.invoke.mockReset()
  mocks.showContextMenu.mockReset()
  mocks.toast.mockReset()
  resetStore()
})

afterEach(() => {
  cleanup()
  resetStore()
  vi.useRealTimers()
})

describe('BookMarksList states', () => {
  it('keeps the list and tag views reachable without a panel header', () => {
    useBookMarksStore.setState({
      bookMarkList: [{ ...bookmark, tags: ['work'] }],
      loadStatus: 'ready',
    })
    renderList()

    fireEvent.click(screen.getByRole('button', { name: 'bookmarks.viewByTags' }))

    expect(screen.getByRole('button', { name: 'bookmarks.viewAsList' })).toBeTruthy()
    expect(screen.getByText('work')).toBeTruthy()
  })

  it('announces loading and load failures and exposes retry', async () => {
    useBookMarksStore.setState({ loadStatus: 'loading' })
    const view = renderList()
    expect(screen.getByRole('status').textContent).toContain('bookmarks.loading')

    view.unmount()
    useBookMarksStore.setState({
      loadError: 'permission denied',
      loadStatus: 'error',
    })
    mocks.invoke.mockResolvedValueOnce({ bookmarks: [] })
    renderList()

    expect(screen.getByRole('alert').textContent).toContain('bookmarks.loadError')
    fireEvent.click(screen.getByRole('button', { name: 'bookmarks.retry' }))
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('get_bookmarks'))
  })

  it('announces the empty state', () => {
    useBookMarksStore.setState({ loadStatus: 'ready' })
    renderList()
    expect(screen.getByRole('status').textContent).toContain('bookmarks.empty')
  })
})

describe('BookMarksList removal', () => {
  it('offers a five-second toast action that restores the removed bookmark', () => {
    useBookMarksStore.setState({ bookMarkList: [bookmark], loadStatus: 'ready' })
    renderList()

    fireEvent.contextMenu(screen.getByRole('button', { name: bookmark.title }))
    const contextMenu = mocks.showContextMenu.mock.calls[0]?.[0] as
      | { items: { handler?: () => void; value: string }[] }
      | undefined
    contextMenu?.items.find((item) => item.value === 'remove')?.handler?.()

    expect(useBookMarksStore.getState().bookMarkList).toEqual([])
    expect(mocks.toast).toHaveBeenCalledTimes(1)
    const toastOptions = mocks.toast.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void }; duration?: number }
      | undefined
    expect(toastOptions?.duration).toBe(BOOKMARK_UNDO_DURATION_MS)

    toastOptions?.action?.onClick()
    expect(useBookMarksStore.getState().bookMarkList).toEqual([bookmark])
  })
})
