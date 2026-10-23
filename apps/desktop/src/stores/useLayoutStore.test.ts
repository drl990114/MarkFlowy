import { beforeEach, describe, expect, it, vi } from 'vitest'
import useLayoutStore, { DEFAULT_DOCK_PANEL_ORDER, DOCK_PREFERENCES_STORAGE_KEY, getAvailableDockPanelIds } from './useLayoutStore'

beforeEach(() => {
  localStorage.removeItem(DOCK_PREFERENCES_STORAGE_KEY)
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
    leftStartup: 'restore',
    rightStartup: 'restore',
    zenModeActive: false,
  })
})

describe('useLayoutStore Zen Mode state', () => {
  it('is transient and disabled by default', () => {
    expect(useLayoutStore.getState().zenModeActive).toBe(false)
  })

  it('toggles Zen Mode without changing sidebar visibility', () => {
    useLayoutStore.getState().setLeftBarVisible(false)
    useLayoutStore.getState().toggleZenMode()

    expect(useLayoutStore.getState().zenModeActive).toBe(true)
    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
    expect(useLayoutStore.getState().rightBar.visible).toBe(true)

    useLayoutStore.getState().setZenModeActive(false)
    expect(useLayoutStore.getState().zenModeActive).toBe(false)
    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
  })

  it('ignores the temporary zero-width resize while Zen Mode hides both sidebars', () => {
    useLayoutStore.setState({
      leftBar: { activePanelId: 'search', size: 304, visible: true },
      rightBar: { activePanelId: 'ai', size: 336, visible: true },
    })

    useLayoutStore.getState().setZenModeActive(true)
    useLayoutStore.getState().syncDockPanelFromResize('left', 0)
    useLayoutStore.getState().syncDockPanelFromResize('right', 0)
    useLayoutStore.getState().setZenModeActive(false)

    expect(useLayoutStore.getState().leftBar).toEqual({
      activePanelId: 'search',
      size: 304,
      visible: true,
    })
    expect(useLayoutStore.getState().rightBar).toEqual({
      activePanelId: 'ai',
      size: 336,
      visible: true,
    })
  })
})

describe('useLayoutStore Dock state', () => {
  it('migrates the legacy raw cache and restores its selected panels and widths', async () => {
    localStorage.setItem(
      DOCK_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        left: { activePanelId: 'search', size: 304 },
        right: { activePanelId: 'ai', size: 336 },
      }),
    )
    vi.resetModules()
    const { default: reloadedLayoutStore } = await import('./useLayoutStore')

    expect(reloadedLayoutStore.getState().leftBar).toEqual({
      activePanelId: 'search',
      size: 304,
      visible: true,
    })
    expect(reloadedLayoutStore.getState().rightBar).toEqual({
      activePanelId: 'ai',
      size: 336,
      visible: true,
    })
  })

  it('switches panels within a Dock and toggles the active panel closed', () => {
    useLayoutStore.getState().toggleDockPanel('left', 'search')

    expect(useLayoutStore.getState().leftBar).toEqual({
      activePanelId: 'search',
      size: 240,
      visible: true,
    })

    useLayoutStore.getState().toggleDockPanel('left', 'search')
    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
  })

  it('keeps both docks open when switching their active panels independently', () => {
    useLayoutStore.getState().toggleDockPanel('right', 'ai')
    expect(useLayoutStore.getState().leftBar.visible).toBe(true)
    expect(useLayoutStore.getState().rightBar).toMatchObject({
      activePanelId: 'ai',
      visible: true,
    })

    useLayoutStore.getState().toggleDockPanel('left', 'search')
    expect(useLayoutStore.getState().leftBar).toMatchObject({
      activePanelId: 'search',
      visible: true,
    })
    expect(useLayoutStore.getState().rightBar.visible).toBe(true)
  })

  it('tracks the latest pixel size without changing panel visibility', () => {
    useLayoutStore.getState().setDockSize('right', 311.6)

    expect(useLayoutStore.getState().rightBar).toEqual({
      activePanelId: 'toc',
      size: 312,
      visible: true,
    })
  })

  it('closes a dock on drag collapse while retaining its last expanded width', () => {
    useLayoutStore.getState().syncDockPanelFromResize('left', 0)
    useLayoutStore.getState().syncDockPanelFromResize('right', 311.6)

    expect(useLayoutStore.getState().leftBar).toEqual({
      activePanelId: 'explorer',
      size: 240,
      visible: false,
    })
    expect(useLayoutStore.getState().rightBar).toEqual({
      activePanelId: 'toc',
      size: 312,
      visible: true,
    })
  })

  it('does not reopen closed docks or overwrite their saved widths from resize callbacks', () => {
    useLayoutStore.getState().setLeftBarVisible(false)
    useLayoutStore.getState().setRightBarVisible(false)
    useLayoutStore.getState().syncDockPanelFromResize('left', 180)
    useLayoutStore.getState().syncDockPanelFromResize('right', 0)

    expect(useLayoutStore.getState().leftBar).toMatchObject({ size: 240, visible: false })
    expect(useLayoutStore.getState().rightBar).toMatchObject({ size: 280, visible: false })
  })

  it('remembers resized widths for both dock sides', () => {
    useLayoutStore.getState().syncDockPanelFromResize('left', 303.6)
    useLayoutStore.getState().syncDockPanelFromResize('right', 220)

    expect(useLayoutStore.getState().leftBar).toMatchObject({ size: 304, visible: true })
    expect(useLayoutStore.getState().rightBar).toMatchObject({ size: 220, visible: true })
  })

  it('persists versioned active panels and clamped pixel sizes', () => {
    useLayoutStore.getState().setDockPanel('left', 'bookmarks')
    useLayoutStore.getState().setDockSize('right', 999)

    expect(JSON.parse(localStorage.getItem(DOCK_PREFERENCES_STORAGE_KEY) ?? '{}')).toEqual({
      version: 3,
      state: {
        panelOrder: DEFAULT_DOCK_PANEL_ORDER,
        documentDocks: {
          leftBar: { activePanelId: 'bookmarks', size: 240, visible: false },
          rightBar: { activePanelId: 'toc', size: 280, visible: false },
        },
        leftBar: { activePanelId: 'bookmarks', size: 240, visible: true },
        rightBar: { activePanelId: 'toc', size: 420, visible: true },
        leftStartup: 'restore',
        rightStartup: 'restore',
      },
    })
  })
})

describe('Dock restart preferences', () => {
  it('restores closed panels without restoring Zen Mode', async () => {
    useLayoutStore.getState().setDockPanel('left', 'bookmarks')
    useLayoutStore.getState().setLeftBarVisible(false)
    useLayoutStore.getState().setRightBarVisible(false)
    useLayoutStore.getState().setZenModeActive(true)
    vi.resetModules()
    const restored = (await import('./useLayoutStore')).default.getState()
    expect(restored.leftBar).toMatchObject({ activePanelId: 'bookmarks', visible: false })
    expect(restored.rightBar.visible).toBe(false)
    expect(restored.zenModeActive).toBe(false)
  })

  it('applies explicit startup panels on the next load without changing this session', async () => {
    useLayoutStore.getState().setLeftBarVisible(false)
    useLayoutStore.getState().setStartupPanel('left', 'search')
    useLayoutStore.getState().setStartupPanel('right', 'ai')
    expect(useLayoutStore.getState().leftBar.activePanelId).toBe('explorer')
    vi.resetModules()
    const restored = (await import('./useLayoutStore')).default.getState()
    expect(restored.leftBar).toMatchObject({ activePanelId: 'search', visible: true })
    expect(restored.rightBar.activePanelId).toBe('ai')
  })

  it('falls back for corrupt state and tolerates denied storage writes', async () => {
    localStorage.setItem(DOCK_PREFERENCES_STORAGE_KEY, '{bad json')
    vi.resetModules()
    const store = (await import('./useLayoutStore')).default
    expect(store.getState().leftBar).toMatchObject({ activePanelId: 'explorer', visible: true })
    const denied = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => store.getState().setLeftBarVisible(false)).not.toThrow()
    expect(store.getState().leftBar.visible).toBe(false)
    denied.mockRestore()
  })
})

describe('document and workspace dock preferences', () => {
  it('starts documents collapsed, remembers their tools, and restores the workspace layout', () => {
    useLayoutStore.getState().setWorkspaceContext(false)
    expect(useLayoutStore.getState().leftBar).toMatchObject({ activePanelId: 'bookmarks', visible: false })
    expect(useLayoutStore.getState().rightBar.visible).toBe(false)
    useLayoutStore.getState().toggleDockPanel('right', 'ai')
    useLayoutStore.getState().setWorkspaceContext(true)
    expect(useLayoutStore.getState().leftBar).toMatchObject({ activePanelId: 'explorer', visible: true })
    expect(useLayoutStore.getState().rightBar).toMatchObject({ activePanelId: 'toc', visible: true })
    useLayoutStore.getState().setWorkspaceContext(false)
    expect(useLayoutStore.getState().rightBar).toMatchObject({ activePanelId: 'ai', visible: true })
    useLayoutStore.getState().openExplorer()
    expect(useLayoutStore.getState().leftBar).toMatchObject({ activePanelId: 'bookmarks', visible: false })
    useLayoutStore.getState().setWorkspaceContext(true)
  })
})


describe('custom Dock layout', () => {
  it('moves the active panel, activates its destination and selects the next source panel', () => {
    useLayoutStore.getState().setDockSize('left', 300)
    useLayoutStore.getState().setDockSize('right', 330)
    useLayoutStore.getState().moveDockPanel('toc', 'left', 1)
    const state = useLayoutStore.getState()
    expect(state.panelOrder).toEqual({ left: ['explorer', 'toc', 'search', 'bookmarks'], right: ['ai'] })
    expect(state.leftBar).toEqual({ activePanelId: 'toc', visible: true, size: 300 })
    expect(state.rightBar).toEqual({ activePanelId: 'ai', visible: true, size: 330 })
  })

  it('interprets same-side insertion boundaries before removing the source', () => {
    const move = useLayoutStore.getState().moveDockPanel
    move('explorer', 'left', 2)
    expect(useLayoutStore.getState().panelOrder.left).toEqual(['search', 'explorer', 'bookmarks'])
    move('explorer', 'left', 0)
    expect(useLayoutStore.getState().panelOrder.left).toEqual(['explorer', 'search', 'bookmarks'])
    const unchanged = useLayoutStore.getState().panelOrder
    move('explorer', 'left', 1)
    expect(useLayoutStore.getState().panelOrder).toBe(unchanged)
    move('explorer', 'left')
    expect(useLayoutStore.getState().panelOrder.left).toEqual(['search', 'bookmarks', 'explorer'])
    expect(useLayoutStore.getState().leftBar.activePanelId).toBe('explorer')
  })

  it('retains a closed source during reorder and clamps insertion boundaries', () => {
    useLayoutStore.getState().setLeftBarVisible(false)
    useLayoutStore.getState().moveDockPanel('bookmarks', 'left', -10)
    expect(useLayoutStore.getState().panelOrder.left).toEqual(['bookmarks', 'explorer', 'search'])
    useLayoutStore.getState().moveDockPanel('bookmarks', 'left', 999)
    expect(useLayoutStore.getState().panelOrder.left).toEqual(['explorer', 'search', 'bookmarks'])
    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
  })

  it('falls back to the previous source panel when moving the last active item', () => {
    useLayoutStore.getState().setDockPanel('left', 'bookmarks')
    useLayoutStore.getState().moveDockPanel('bookmarks', 'right')
    expect(useLayoutStore.getState().leftBar.activePanelId).toBe('search')
  })

  it('closes an emptied side, prevents empty reopening and accepts a later return', () => {
    useLayoutStore.getState().moveDockPanel('toc', 'left')
    useLayoutStore.getState().moveDockPanel('ai', 'left')
    expect(useLayoutStore.getState().rightBar).toEqual({ activePanelId: null, visible: false, size: 280 })
    useLayoutStore.getState().toggleDockPanel('right', null)
    useLayoutStore.getState().setRightBarVisible(true)
    expect(useLayoutStore.getState().rightBar.visible).toBe(false)
    useLayoutStore.getState().moveDockPanel('bookmarks', 'right')
    expect(useLayoutStore.getState().rightBar).toEqual({ activePanelId: 'bookmarks', visible: true, size: 280 })
  })

  it('opens Explorer on its assigned side and rejects selecting panels owned by the other side', () => {
    useLayoutStore.getState().moveDockPanel('explorer', 'right')
    useLayoutStore.getState().setRightBarVisible(false)
    useLayoutStore.getState().openExplorer()
    expect(useLayoutStore.getState().rightBar).toMatchObject({ activePanelId: 'explorer', visible: true })
    useLayoutStore.getState().setDockPanel('left', 'explorer')
    useLayoutStore.getState().toggleDockPanel('left', 'explorer')
    expect(useLayoutStore.getState().leftBar.activePanelId).toBe('search')
  })

  it('repairs document preferences without opening their destination or losing their widths', () => {
    useLayoutStore.getState().setWorkspaceContext(false)
    useLayoutStore.getState().openDockPanel('bookmarks')
    useLayoutStore.getState().setDockSize('left', 310)
    useLayoutStore.getState().setWorkspaceContext(true)
    useLayoutStore.getState().moveDockPanel('bookmarks', 'right')
    useLayoutStore.getState().setWorkspaceContext(false)
    expect(useLayoutStore.getState().leftBar).toEqual({ activePanelId: null, visible: false, size: 310 })
    expect(useLayoutStore.getState().rightBar).toMatchObject({ activePanelId: 'toc', visible: false })
    expect(getAvailableDockPanelIds(useLayoutStore.getState().panelOrder, 'left', false)).toEqual([])
    const before = useLayoutStore.getState()
    useLayoutStore.getState().openExplorer()
    useLayoutStore.getState().openDockPanel('search')
    useLayoutStore.getState().moveDockPanel('explorer', 'right')
    expect(useLayoutStore.getState()).toBe(before)
    expect(useLayoutStore.getState().panelOrder.left).toEqual(['explorer', 'search'])
  })

  it('repairs the inactive workspace profile when moving from document mode', () => {
    useLayoutStore.getState().setDockSize('right', 350)
    useLayoutStore.getState().setWorkspaceContext(false)
    useLayoutStore.getState().moveDockPanel('toc', 'left')
    expect(useLayoutStore.getState().leftBar).toMatchObject({ activePanelId: 'toc', visible: true })
    useLayoutStore.getState().setWorkspaceContext(true)
    expect(useLayoutStore.getState().leftBar.activePanelId).toBe('explorer')
    expect(useLayoutStore.getState().rightBar).toEqual({ activePanelId: 'ai', visible: true, size: 350 })
  })

  it('clears a startup selection moved away and leaves the destination preference alone', () => {
    useLayoutStore.getState().setStartupPanel('left', 'bookmarks')
    useLayoutStore.getState().setStartupPanel('right', 'ai')
    useLayoutStore.getState().moveDockPanel('bookmarks', 'right')
    expect(useLayoutStore.getState().leftStartup).toBe('restore')
    expect(useLayoutStore.getState().rightStartup).toBe('ai')
    useLayoutStore.getState().setStartupPanel('left', 'bookmarks')
    expect(useLayoutStore.getState().leftStartup).toBe('restore')
    useLayoutStore.getState().setStartupPanel('right', 'bookmarks')
    expect(useLayoutStore.getState().rightStartup).toBe('bookmarks')
  })

  it('resets placement while retaining width, visibility and still-valid active selections', () => {
    useLayoutStore.getState().moveDockPanel('toc', 'left')
    useLayoutStore.getState().moveDockPanel('bookmarks', 'right')
    useLayoutStore.getState().setStartupPanel('left', 'toc')
    useLayoutStore.getState().setDockSize('left', 302)
    useLayoutStore.getState().setRightBarVisible(false)
    useLayoutStore.getState().resetDockLayout()
    expect(useLayoutStore.getState().panelOrder).toEqual(DEFAULT_DOCK_PANEL_ORDER)
    expect(useLayoutStore.getState().leftBar).toEqual({ activePanelId: 'explorer', visible: true, size: 302 })
    expect(useLayoutStore.getState().rightBar).toEqual({ activePanelId: 'toc', visible: false, size: 280 })
    expect(useLayoutStore.getState().leftStartup).toBe('restore')
  })

  it('migrates v2 preferences and preserves separate document state and startup choices', async () => {
    localStorage.setItem(DOCK_PREFERENCES_STORAGE_KEY, JSON.stringify({
      version: 2,
      state: {
        leftBar: { activePanelId: 'bookmarks', visible: false, size: 302 },
        rightBar: { activePanelId: 'ai', visible: true, size: 350 },
        documentDocks: {
          leftBar: { activePanelId: 'bookmarks', visible: true, size: 190 },
          rightBar: { activePanelId: 'ai', visible: false, size: 230 },
        },
        leftStartup: 'restore', rightStartup: 'ai',
      },
    }))
    vi.resetModules()
    const restored = (await import('./useLayoutStore')).default.getState()
    expect(restored.panelOrder).toEqual(DEFAULT_DOCK_PANEL_ORDER)
    expect(restored.leftBar).toEqual({ activePanelId: 'bookmarks', visible: false, size: 302 })
    expect(restored.rightBar).toEqual({ activePanelId: 'ai', visible: true, size: 350 })
    expect(restored.documentDocks).toEqual({
      leftBar: { activePanelId: 'bookmarks', visible: true, size: 190 },
      rightBar: { activePanelId: 'ai', visible: false, size: 230 },
    })
    expect(JSON.parse(localStorage.getItem(DOCK_PREFERENCES_STORAGE_KEY) ?? '{}').version).toBe(3)
  })

  it('restores placements and both profiles after persisting from document mode', async () => {
    useLayoutStore.getState().setWorkspaceContext(false)
    useLayoutStore.getState().moveDockPanel('toc', 'left')
    useLayoutStore.getState().setDockSize('left', 310)
    vi.resetModules()
    const store = (await import('./useLayoutStore')).default
    expect(store.getState().panelOrder).toEqual({ left: ['explorer', 'search', 'bookmarks', 'toc'], right: ['ai'] })
    expect(store.getState().leftBar).toMatchObject({ activePanelId: 'explorer', visible: true, size: 240 })
    expect(store.getState().rightBar.activePanelId).toBe('ai')
    store.getState().setWorkspaceContext(false)
    expect(store.getState().leftBar).toEqual({ activePanelId: 'toc', visible: true, size: 310 })
  })

  it('repairs duplicate and unknown IDs, appends missing IDs, and validates saved selections', async () => {
    localStorage.setItem(DOCK_PREFERENCES_STORAGE_KEY, JSON.stringify({
      version: 3,
      state: {
        panelOrder: { left: ['toc', 'unknown', 'toc'], right: ['toc', 'bookmarks'] },
        leftBar: { activePanelId: 'ai', visible: true, size: -5 },
        rightBar: { activePanelId: 'bookmarks', visible: false, size: 999 },
        leftStartup: 'ai', rightStartup: 'bookmarks',
      },
    }))
    vi.resetModules()
    const restored = (await import('./useLayoutStore')).default.getState()
    expect(restored.panelOrder).toEqual({ left: ['toc', 'explorer', 'search'], right: ['bookmarks', 'ai'] })
    expect(restored.leftBar).toEqual({ activePanelId: 'toc', visible: true, size: 180 })
    expect(restored.rightBar).toEqual({ activePanelId: 'bookmarks', visible: true, size: 420 })
    expect(restored.leftStartup).toBe('restore')
  })

  it('preserves a deliberately empty side across restarts', async () => {
    useLayoutStore.getState().moveDockPanel('toc', 'left')
    useLayoutStore.getState().moveDockPanel('ai', 'left')
    vi.resetModules()
    const restored = (await import('./useLayoutStore')).default.getState()
    expect(restored.panelOrder.right).toEqual([])
    expect(restored.rightBar).toEqual({ activePanelId: null, visible: false, size: 280 })
    expect(restored.documentDocks.rightBar.activePanelId).toBeNull()
  })
})
