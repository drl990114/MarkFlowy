import { TooltipProvider } from '@/components/ui/tooltip'
import useLayoutStore from '@/stores/useLayoutStore'
import useEditorStore from '@/stores/useEditorStore'
import { desktopDarkTheme } from '@markflowy/theme'
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DockSwitcher } from './DockSwitcher'
import { DockDragLifecycle } from './DockDragLifecycle'
import { DockPanelMenu } from './DockPanelMenu'
import { clearDockDrag, DOCK_PANEL_DRAG_TYPE, readDockPanelDragData, useDockDragStore } from './dockDragData'

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

beforeEach(() => {
  useLayoutStore.setState(useLayoutStore.getInitialState())
  clearDockDrag()
  useEditorStore.setState({ folderData: [{ id: 'workspace', kind: 'dir', name: 'Workspace', path: '/workspace' }] })
  useLayoutStore.setState({
    leftBar: { activePanelId: 'explorer', size: 240, visible: true },
    rightBar: { activePanelId: 'toc', size: 280, visible: true },
    zenModeActive: false,
  })
})

afterEach(() => { cleanup(); clearDockDrag(); vi.restoreAllMocks() })

function renderSwitcher() {
  return render(
    <ThemeProvider theme={desktopDarkTheme}>
      <TooltipProvider>
        <DockSwitcher side='left' />
      </TooltipProvider>
    </ThemeProvider>,
  )
}

describe('DockSwitcher', () => {
  it('keeps bookmarks available without showing workspace tools for independent documents', () => {
    useEditorStore.setState({ folderData: null })
    renderSwitcher()
    expect(screen.queryByRole('button', { name: /files|explorer/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /search/i })).toBeNull()
    expect(screen.getByRole('button', { name: /bookmarks/i })).toBeTruthy()
  })
  it('uses the theme accent only on the active icon', () => {
    renderSwitcher()

    const explorer = screen.getByRole('button', { name: /files|explorer/i })
    const search = screen.getByRole('button', { name: /search/i })

    expect(explorer.getAttribute('aria-pressed')).toBe('true')
    expect(search.getAttribute('aria-pressed')).toBe('false')
    expect(explorer.querySelector('svg')?.getAttribute('class')).toContain('text-primary')
    expect(search.querySelector('svg')?.getAttribute('class') ?? '').not.toContain('text-primary')

    fireEvent.click(search)

    expect(explorer.querySelector('svg')?.getAttribute('class') ?? '').not.toContain(
      'text-primary',
    )
    expect(search.querySelector('svg')?.getAttribute('class')).toContain('text-primary')
  })

  it('switches to another panel without closing the Dock', () => {
    renderSwitcher()

    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    expect(useLayoutStore.getState().leftBar).toMatchObject({
      activePanelId: 'search',
      visible: true,
    })
  })

  it('closes the Dock when the active panel is pressed again', () => {
    renderSwitcher()

    const explorer = screen.getByRole('button', { name: /files|explorer/i })
    fireEvent.click(explorer)

    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
    expect(explorer.getAttribute('aria-pressed')).toBe('false')
    expect(explorer.querySelector('svg')?.getAttribute('class') ?? '').not.toContain(
      'text-primary',
    )
  })
})

function transfer(type?: string, payload?: string) {
  const values = new Map<string, string>(type ? [[type, payload ?? '']] : [])
  return {
    get types() { return [...values.keys()] },
    getData: (key: string) => values.get(key) ?? '',
    setData: (key: string, value: string) => { values.set(key, value) },
    effectAllowed: 'none', dropEffect: 'none',
  } as unknown as DataTransfer
}

function renderMovableDocks() {
  return render(<ThemeProvider theme={desktopDarkTheme}><TooltipProvider>
    <DockSwitcher side='left' /><DockSwitcher side='right' />
    <div data-slot='dock-toolbar'><DockPanelMenu panelId='toc' /></div>
    <DockDragLifecycle />
  </TooltipProvider></ThemeProvider>)
}

describe('Dock layout interactions', () => {
  it('moves from the real icon context menu and restores focus to its new icon', async () => {
    renderMovableDocks()
    const user = userEvent.setup()
    const files = screen.getByRole('button', { name: 'Files' })
    fireEvent.contextMenu(files, { clientX: 8, clientY: 8 })
    await user.click(await screen.findByRole('menuitem', { name: 'sidebar.move_right' }))
    expect(useLayoutStore.getState().panelOrder.right).toEqual(['toc', 'ai', 'explorer'])
    expect(useLayoutStore.getState().rightBar.activePanelId).toBe('explorer')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Files' })))
  })

  it('opens the independent more button by keyboard and offers reset', async () => {
    renderMovableDocks()
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: 'sidebar.panel_actions' })
    button.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('menuitem', { name: 'sidebar.move_left' })).toBeTruthy()
    await user.click(screen.getByRole('menuitem', { name: 'sidebar.move_left' }))
    expect(useLayoutStore.getState().panelOrder.left).toContain('toc')
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Table of Contents' }))
    await user.click(await screen.findByRole('menuitem', { name: 'sidebar.reset_layout' }))
    expect(useLayoutStore.getState().panelOrder.right).toEqual(['toc', 'ai'])
  })

  it('shows insertion feedback and reorders only on drop, without toggling the active panel', () => {
    const view = renderMovableDocks()
    const dataTransfer = transfer()
    const files = screen.getByRole('button', { name: 'Files' })
    const bookmark = screen.getByRole('button', { name: 'Bookmarks' })
    fireEvent.dragStart(files, { dataTransfer })
    const hover = createEvent.dragOver(bookmark, { dataTransfer })
    Object.defineProperty(hover, 'clientX', { value: 40 })
    fireEvent(bookmark, hover)
    expect(useLayoutStore.getState().panelOrder.left).toEqual(['explorer', 'search', 'bookmarks'])
    expect(view.container.querySelector('[data-drop-edge="after"]')).toBeTruthy()
    fireEvent.drop(bookmark, { dataTransfer })
    expect(useLayoutStore.getState().panelOrder.left).toEqual(['search', 'bookmarks', 'explorer'])
    expect(useLayoutStore.getState().leftBar).toMatchObject({ activePanelId: 'explorer', visible: true })
  })

  it('keeps hidden sides reachable from their bottom icons and expands the destination', () => {
    useLayoutStore.getState().setRightBarVisible(false)
    const view = renderMovableDocks()
    expect(view.container.querySelector('.mf-dock-edge-target')).toBeNull()
    const dataTransfer = transfer()
    fireEvent.dragStart(screen.getByRole('button', { name: 'Files' }), { dataTransfer })
    const target = screen.getByRole('group', { name: 'sidebar.rightDock' })
    expect(target).toBeTruthy()
    fireEvent.dragOver(target, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })
    expect(useLayoutStore.getState().rightBar).toMatchObject({ activePanelId: 'explorer', visible: true })
    expect(view.container.querySelector('.mf-dock-edge-target')).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('draws the insertion edge beside the hovered icon when a workspace-only icon is filtered out', () => {
    useLayoutStore.getState().moveDockPanel('explorer', 'right', 1)
    useLayoutStore.getState().setWorkspaceContext(false)
    useEditorStore.setState({ folderData: null })
    const view = renderMovableDocks()
    const dataTransfer = transfer()
    fireEvent.dragStart(screen.getByRole('button', { name: 'Bookmarks' }), { dataTransfer })
    const outline = screen.getByRole('button', { name: 'Table of Contents' })
    const hover = createEvent.dragOver(outline, { dataTransfer })
    Object.defineProperty(hover, 'clientX', { value: 40 })
    fireEvent(outline, hover)
    expect(outline.closest('[data-drop-edge="after"]')).toBeTruthy()
    expect(view.container.querySelectorAll('[data-drop-edge]')).toHaveLength(1)
    fireEvent.drop(outline, { dataTransfer })
    expect(useLayoutStore.getState().panelOrder.right).toEqual(['toc', 'bookmarks', 'explorer', 'ai'])
  })

  it('cancels without changing layout and clears indicators on dragend or loss of window focus', () => {
    const view = renderMovableDocks()
    const before = useLayoutStore.getState().panelOrder
    const files = screen.getByRole('button', { name: 'Files' })
    fireEvent.dragStart(files, { dataTransfer: transfer() })
    fireEvent.dragEnd(files)
    expect(useLayoutStore.getState().panelOrder).toBe(before)
    expect(useDockDragStore.getState().panelId).toBeNull()
    fireEvent.dragStart(files, { dataTransfer: transfer() })
    fireEvent.blur(window)
    expect(useDockDragStore.getState().panelId).toBeNull()
    expect(view.container.querySelector('[data-drop-edge]')).toBeNull()
  })

  it.each(['Files', 'application/x-markflowy-editor-tab', 'application/x-react-arborist'])('does not intercept %s drops', (type) => {
    renderMovableDocks()
    const before = useLayoutStore.getState().panelOrder
    const target = screen.getByRole('button', { name: 'Bookmarks' })
    const dataTransfer = transfer(type, '{}')
    expect(fireEvent.dragOver(target, { dataTransfer })).toBe(true)
    expect(fireEvent.drop(target, { dataTransfer })).toBe(true)
    expect(useLayoutStore.getState().panelOrder).toBe(before)
  })

  it.each(['{', '{}', '{"panelId":"unknown"}', 'null'])('rejects malformed panel data %s', (payload) => {
    expect(readDockPanelDragData(transfer(DOCK_PANEL_DRAG_TYPE, payload))).toBeUndefined()
  })

  it('keeps both sides usable after moving the dragged source button out of its original group', () => {
    renderMovableDocks()
    const dataTransfer = transfer()
    fireEvent.dragStart(screen.getByRole('button', { name: 'Files' }), { dataTransfer })
    fireEvent.drop(screen.getByRole('group', { name: 'sidebar.rightDock' }), { dataTransfer })
    vi.spyOn(Date, 'now').mockReturnValue(Number.MAX_SAFE_INTEGER)
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Search' })))
    expect(useLayoutStore.getState().leftBar.activePanelId).toBe('search')
    act(() => fireEvent.click(screen.getByRole('button', { name: 'AI' })))
    expect(useLayoutStore.getState().rightBar.activePanelId).toBe('ai')
  })
})
