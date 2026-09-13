import { beforeEach, describe, expect, it, vi } from 'vitest'
import useLayoutStore, { DOCK_PREFERENCES_STORAGE_KEY } from './useLayoutStore'

beforeEach(() => {
  localStorage.removeItem(DOCK_PREFERENCES_STORAGE_KEY)
  useLayoutStore.setState({
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
      version: 2,
      state: {
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
