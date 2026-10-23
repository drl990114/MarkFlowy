import useLayoutStore, { DEFAULT_DOCK_PANEL_ORDER, type DockPanelId, type DockSide } from '@/stores/useLayoutStore'
import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SideBar from '.'
import RightBar from './RightBar'

vi.mock('@/components/Explorer', () => ({
  default: () => <div data-testid='explorer-panel' />,
}))

vi.mock('@/extensions/search', () => ({
  Search: { components: <div data-testid='search-panel' /> },
}))

vi.mock('@/extensions/bookmarks', () => ({
  default: { components: <div data-testid='bookmarks-panel' /> },
}))

vi.mock('@/extensions/table-of-content', () => ({
  default: { components: <div data-testid='toc-panel' /> },
}))

vi.mock('@/extensions/ai', () => ({
  default: { components: <div data-testid='ai-panel' /> },
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

beforeEach(() => {
  useLayoutStore.setState({
    panelOrder: { left: [...DEFAULT_DOCK_PANEL_ORDER.left], right: [...DEFAULT_DOCK_PANEL_ORDER.right] },
    hasWorkspace: true,
    workspaceDocks: undefined,
    documentDocks: {
      leftBar: { activePanelId: 'bookmarks', size: 240, visible: false },
      rightBar: { activePanelId: 'toc', size: 280, visible: false },
    },
    leftBar: { activePanelId: 'explorer', size: 240, visible: true },
    rightBar: { activePanelId: 'toc', size: 280, visible: true },
    zenModeActive: false,
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


const allPanels: DockPanelId[] = ['explorer', 'search', 'bookmarks', 'toc', 'ai']

describe.each(['left', 'right'] satisfies DockSide[])('%s Dock configurable content', (side) => {
  it.each(allPanels)('renders %s in its assigned side after relocation', async (panelId) => {
    useLayoutStore.getState().moveDockPanel(panelId, side)
    useLayoutStore.getState().openDockPanel(panelId)
    const { container } = render(
      <ThemeProvider theme={desktopLightTheme}>
        {side === 'left' ? <SideBar /> : <RightBar />}
      </ThemeProvider>,
    )
    expect(await screen.findByTestId(`${panelId}-panel`)).toBeTruthy()
    expect(container.querySelector(`[data-mf-dock-panel="${panelId}"]`)).toBeTruthy()
    for (const otherId of allPanels.filter((id) => id !== panelId)) {
      expect(screen.queryByTestId(`${otherId}-panel`)).toBeNull()
    }
    expect(container.querySelector('[data-slot="dock-toolbar"]')).toBeNull()
  })

  it('does not mount content for an empty side', () => {
    const otherSide = side === 'left' ? 'right' : 'left'
    for (const panelId of [...useLayoutStore.getState().panelOrder[side]]) {
      useLayoutStore.getState().moveDockPanel(panelId, otherSide)
    }
    const { container } = render(
      <ThemeProvider theme={desktopLightTheme}>
        {side === 'left' ? <SideBar /> : <RightBar />}
      </ThemeProvider>,
    )
    for (const panelId of allPanels) expect(screen.queryByTestId(`${panelId}-panel`)).toBeNull()
    expect(container.querySelector('[data-mf-dock-panel]')).toBeNull()
  })
})

describe('Dock context changes', () => {
  it('keeps workspace-only content unavailable in document mode after custom placement', async () => {
    useLayoutStore.getState().moveDockPanel('explorer', 'right')
    useLayoutStore.getState().moveDockPanel('search', 'right')
    useLayoutStore.getState().setWorkspaceContext(false)
    useLayoutStore.getState().openDockPanel('toc')
    render(
      <ThemeProvider theme={desktopLightTheme}>
        <SideBar /><RightBar />
      </ThemeProvider>,
    )
    expect(await screen.findByTestId('toc-panel')).toBeTruthy()
    act(() => {
      useLayoutStore.getState().openDockPanel('explorer')
      useLayoutStore.getState().openDockPanel('search')
    })
    expect(screen.queryByTestId('explorer-panel')).toBeNull()
    expect(screen.queryByTestId('search-panel')).toBeNull()
    expect(screen.getByTestId('toc-panel')).toBeTruthy()
  })

  it('keeps an already mounted relocated panel through Zen Mode', async () => {
    useLayoutStore.getState().moveDockPanel('toc', 'left')
    renderSideBar()
    const content = await screen.findByTestId('toc-panel')
    act(() => useLayoutStore.getState().setZenModeActive(true))
    expect(screen.getByTestId('toc-panel')).toBe(content)
    act(() => useLayoutStore.getState().setZenModeActive(false))
    expect(screen.getByTestId('toc-panel')).toBe(content)
  })
})
