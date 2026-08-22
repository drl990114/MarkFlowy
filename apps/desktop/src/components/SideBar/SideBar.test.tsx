import useLayoutStore from '@/stores/useLayoutStore'
import { desktopLightTheme } from '@markflowy/theme'
import { cleanup, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SideBar from '.'

vi.mock('@/components', () => ({
  Explorer: () => <div data-testid='explorer-panel' />,
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
