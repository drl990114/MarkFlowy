import useLayoutStore from '@/stores/useLayoutStore'
import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SideBar from '.'

vi.mock('@/components/Explorer', () => ({
  default: () => <div data-testid='explorer-panel' />,
}))

vi.mock('@/extensions/search', () => ({
  Search: { components: <div data-testid='search-panel' /> },
}))

vi.mock('@/extensions/bookmarks', () => ({
  default: { components: <div data-testid='bookmarks-panel' /> },
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

beforeEach(() => {
  useLayoutStore.setState({
    leftBar: { activePanelId: 'explorer', size: 240, visible: true },
  })
})

afterEach(cleanup)

function renderSideBar() {
  return render(
    <ThemeProvider theme={desktopLightTheme}>
      <SideBar />
    </ThemeProvider>,
  )
}

describe('left Dock composition', () => {
  it('delays a hidden panel until first opening, then retains its mounted state', async () => {
    useLayoutStore.setState((state) => ({ leftBar: { ...state.leftBar, visible: false } }))
    renderSideBar()
    expect(screen.queryByTestId('explorer-panel')).toBeNull()
    act(() => useLayoutStore.setState((state) => ({ leftBar: { ...state.leftBar, visible: true } })))
    const panel = await screen.findByTestId('explorer-panel')
    act(() => useLayoutStore.setState((state) => ({ leftBar: { ...state.leftBar, visible: false } })))
    expect(screen.getByTestId('explorer-panel')).toBe(panel)
  })

  it('renders Explorer content without a visible panel header', () => {
    renderSideBar()

    expect(screen.getByTestId('explorer-panel')).toBeTruthy()
    expect(screen.queryByText('sidebar.explorer')).toBeNull()
  })

  it.each([
    ['search', 'search-panel', 'sidebar.search'],
    ['bookmarks', 'bookmarks-panel', 'sidebar.bookmarks'],
  ] as const)('renders %s content without a visible panel header', async (panelId, testId, label) => {
    useLayoutStore.setState((state) => ({
      leftBar: { ...state.leftBar, activePanelId: panelId },
    }))
    renderSideBar()

    expect(await screen.findByTestId(testId)).toBeTruthy()
    expect(screen.queryByText(label)).toBeNull()
  })
})
