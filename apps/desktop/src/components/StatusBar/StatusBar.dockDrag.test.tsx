import { TooltipProvider } from '@/components/ui/tooltip'
import useEditorStore from '@/stores/useEditorStore'
import useLayoutStore, { type DockSide } from '@/stores/useLayoutStore'
import { desktopDarkTheme } from '@markflowy/theme'
import { cleanup, createEvent, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DockDragLifecycle } from '../SideBar/DockDragLifecycle'
import { clearDockDrag, useDockDragStore } from '../SideBar/dockDragData'
import StatusBar from './index'

vi.mock('@/hooks', () => ({ useGlobalOSInfo: () => ({ osType: 'macos' }) }))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))
vi.mock('react-use', () => ({ useMedia: () => false }))
vi.mock('../WorkspaceActions', () => ({ WorkspaceActions: () => null }))
vi.mock('./SettingBtn', () => ({ CenterMenu: () => null }))
vi.mock('./StatusOverflow', () => ({ StatusOverflow: () => null }))
vi.mock('./EditorCount', () => ({
  EditorCount: () => <span data-testid='editor-count'>120 words</span>,
}))
vi.mock('./ZenModeButton', () => ({
  ZenModeButton: () => <button type='button'>Zen mode</button>,
}))

beforeEach(() => {
  useLayoutStore.setState(useLayoutStore.getInitialState())
  clearDockDrag()
  useEditorStore.setState({
    folderData: [{ id: 'workspace', kind: 'dir', name: 'Workspace', path: '/workspace' }],
  })
  useLayoutStore.setState({
    leftBar: { activePanelId: 'explorer', size: 240, visible: true },
    rightBar: { activePanelId: 'toc', size: 280, visible: true },
    zenModeActive: false,
  })
})

afterEach(() => {
  cleanup()
  clearDockDrag()
  vi.restoreAllMocks()
})

function transfer(type?: string) {
  const values = new Map<string, string>(type ? [[type, '']] : [])
  return {
    get types() { return [...values.keys()] },
    getData: (key: string) => values.get(key) ?? '',
    setData: (key: string, value: string) => { values.set(key, value) },
    effectAllowed: 'none',
    dropEffect: 'none',
  } as unknown as DataTransfer
}

function renderStatusBar() {
  return render(
    <ThemeProvider theme={desktopDarkTheme}>
      <TooltipProvider>
        <StatusBar />
        <DockDragLifecycle />
      </TooltipProvider>
    </ThemeProvider>,
  )
}

function dropRegion(side: DockSide) {
  const region = screen.getByRole('toolbar').querySelector<HTMLElement>(
    `[data-mf-dock-drop-side='${side}']`,
  )
  if (!region) throw new Error(`Missing ${side} bottom drop region`)
  return region
}

function startDrag(label: string) {
  const dataTransfer = transfer()
  fireEvent.dragStart(screen.getByRole('button', { name: label }), { dataTransfer })
  return dataTransfer
}

function expectDragCleared() {
  expect(useDockDragStore.getState().panelId).toBeNull()
  expect(screen.getByRole('toolbar').hasAttribute('data-mf-dock-dragging')).toBe(false)
  expect(screen.queryByText('sidebar.move_left')).toBeNull()
  expect(screen.queryByText('sidebar.move_right')).toBeNull()
  expect(dropRegion('left').hasAttribute('data-drop-over')).toBe(false)
  expect(dropRegion('right').hasAttribute('data-drop-over')).toBe(false)
}

describe('StatusBar Dock drag targets', () => {
  it('shows both bottom targets as soon as an icon starts dragging with both Docks open', () => {
    renderStatusBar()
    expectDragCleared()
    const files = screen.getByRole('button', { name: 'Files' })
    const toc = screen.getByRole('button', { name: 'Table of Contents' })

    startDrag('Files')

    expect(screen.getByRole('toolbar').hasAttribute('data-mf-dock-dragging')).toBe(true)
    for (const side of ['left', 'right'] as const) {
      const region = dropRegion(side)
      const hint = within(region).getByText(`sidebar.move_${side}`)
      expect(hint.classList.contains('mf-dock-drop-hint')).toBe(true)
      expect(getComputedStyle(hint).display).not.toBe('none')
      expect(region.hasAttribute('data-drop-over')).toBe(false)
    }
    expect(screen.getByRole('button', { name: 'Files' })).toBe(files)
    expect(screen.getByRole('button', { name: 'Table of Contents' })).toBe(toc)
    expect(getComputedStyle(screen.getByTestId('editor-count')).visibility).toBe('hidden')
    expect(useLayoutStore.getState().leftBar.visible).toBe(true)
    expect(useLayoutStore.getState().rightBar.visible).toBe(true)
  })

  it.each([
    { label: 'Files', panelId: 'explorer', source: 'left', target: 'right' },
    { label: 'Table of Contents', panelId: 'toc', source: 'right', target: 'left' },
  ] as const)('moves $label through the blank $target bottom region and appends it', ({ label, panelId, source, target }) => {
    renderStatusBar()
    const previousOrder = useLayoutStore.getState().panelOrder
    const dataTransfer = startDrag(label)
    const region = dropRegion(target)

    const hover = createEvent.dragOver(region, { dataTransfer }) as DragEvent
    expect(fireEvent(region, hover)).toBe(false)
    expect(region.hasAttribute('data-drop-over')).toBe(true)
    expect(hover.dataTransfer?.dropEffect).toBe('move')
    expect(fireEvent.drop(region, { dataTransfer })).toBe(false)

    const state = useLayoutStore.getState()
    expect(state.panelOrder[source]).toEqual(previousOrder[source].filter((id) => id !== panelId))
    expect(state.panelOrder[target]).toEqual([...previousOrder[target], panelId])
    expect(state[target === 'left' ? 'leftBar' : 'rightBar']).toMatchObject({
      activePanelId: panelId,
      visible: true,
    })
    expect(within(region).getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true')
    expectDragCleared()
  })

  it.each([
    { target: 'left', source: 'right', label: 'Table of Contents', panelId: 'toc', empty: false },
    { target: 'right', source: 'left', label: 'Bookmarks', panelId: 'bookmarks', empty: false },
    { target: 'left', source: 'right', label: 'Table of Contents', panelId: 'toc', empty: true },
    { target: 'right', source: 'left', label: 'Bookmarks', panelId: 'bookmarks', empty: true },
  ] as const)('accepts a drop into the hidden $target Dock (empty: $empty) and opens it', ({ target, source, label, panelId, empty }) => {
    if (empty) {
      for (const id of useLayoutStore.getState().panelOrder[target]) {
        useLayoutStore.getState().moveDockPanel(id, source)
      }
    } else {
      const key = target === 'left' ? 'leftBar' : 'rightBar'
      useLayoutStore.setState({ [key]: { ...useLayoutStore.getState()[key], visible: false } })
    }
    const dockKey = target === 'left' ? 'leftBar' : 'rightBar'
    expect(useLayoutStore.getState()[dockKey].visible).toBe(false)
    if (empty) expect(useLayoutStore.getState().panelOrder[target]).toEqual([])
    renderStatusBar()
    const region = dropRegion(target)
    const dataTransfer = startDrag(label)

    expect(within(region).getByText(`sidebar.move_${target}`)).toBeTruthy()
    fireEvent.dragOver(region, { dataTransfer })
    fireEvent.drop(region, { dataTransfer })

    expect(useLayoutStore.getState()[dockKey]).toMatchObject({ activePanelId: panelId, visible: true })
    expect(useLayoutStore.getState().panelOrder[target].at(-1)).toBe(panelId)
    expect(within(region).getByRole('button', { name: label })).toBeTruthy()
    expectDragCleared()
  })

  it.each(['dragend', 'blur'] as const)('clears temporary targets on %s without moving panels', (cancel) => {
    renderStatusBar()
    const before = useLayoutStore.getState()
    const dataTransfer = startDrag('Files')
    fireEvent.dragOver(dropRegion('right'), { dataTransfer })
    expect(dropRegion('right').hasAttribute('data-drop-over')).toBe(true)

    if (cancel === 'dragend') {
      fireEvent.dragEnd(screen.getByRole('button', { name: 'Files' }), { dataTransfer })
    } else {
      fireEvent.blur(window)
    }

    expectDragCleared()
    expect(useLayoutStore.getState().panelOrder).toEqual(before.panelOrder)
    expect(useLayoutStore.getState().leftBar).toEqual(before.leftBar)
    expect(useLayoutStore.getState().rightBar).toEqual(before.rightBar)
    expect(screen.getByTestId('editor-count').textContent).toBe('120 words')
    expect(getComputedStyle(screen.getByTestId('editor-count')).visibility).not.toBe('hidden')
  })

  it('keeps the same drag active when leaving the window and returning to an empty bottom target', () => {
    for (const id of useLayoutStore.getState().panelOrder.left) {
      useLayoutStore.getState().moveDockPanel(id, 'right')
    }
    renderStatusBar()
    const before = useLayoutStore.getState().panelOrder
    const dataTransfer = startDrag('Table of Contents')

    const leave = createEvent.dragLeave(document)
    Object.defineProperties(leave, {
      relatedTarget: { value: null },
      clientX: { value: -1 },
      clientY: { value: 100 },
    })
    fireEvent(document, leave)

    expect(useDockDragStore.getState().panelId).toBe('toc')
    expect(useLayoutStore.getState().panelOrder).toEqual(before)
    expect(screen.getByRole('toolbar').hasAttribute('data-mf-dock-dragging')).toBe(true)
    expect(within(dropRegion('left')).getByText('sidebar.move_left')).toBeTruthy()

    fireEvent.dragOver(dropRegion('left'), { dataTransfer })
    fireEvent.drop(dropRegion('left'), { dataTransfer })

    expect(useLayoutStore.getState().panelOrder.left).toEqual(['toc'])
    expect(useLayoutStore.getState().leftBar).toMatchObject({ activePanelId: 'toc', visible: true })
    expectDragCleared()
  })

  it.each(['left', 'right'] as const)('does not intercept unrelated Files drags over the %s bottom region', (side) => {
    renderStatusBar()
    const before = useLayoutStore.getState().panelOrder
    const dataTransfer = transfer('Files')
    const region = dropRegion(side)
    const bubble = vi.fn()
    window.addEventListener('drop', bubble)
    try {
      expect(fireEvent.dragOver(region, { dataTransfer })).toBe(true)
      expect(fireEvent.drop(region, { dataTransfer })).toBe(true)
      expect(bubble).toHaveBeenCalledOnce()
      expect(dataTransfer.dropEffect).toBe('none')
      expect(useLayoutStore.getState().panelOrder).toEqual(before)
      expectDragCleared()
    } finally {
      window.removeEventListener('drop', bubble)
    }
  })
})
