import { beforeEach, describe, expect, it, vi } from 'vitest'
import useLayoutStore, {
  closeCompactLeftDockAfterSelection,
  DOCK_PREFERENCES_STORAGE_KEY,
} from './useLayoutStore'

beforeEach(() => {
  localStorage.removeItem(DOCK_PREFERENCES_STORAGE_KEY)
  useLayoutStore.setState({
    leftBar: { activePanelId: 'explorer', size: 240, visible: true },
    rightBar: { activePanelId: 'toc', size: 280, visible: true },
    leftStartup: 'restore',
    rightStartup: 'restore',
    overlayDock: null,
    viewportMode: 'wide',
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

  it('restores a responsive overlay Dock after leaving Zen Mode', () => {
    useLayoutStore.getState().setViewportMode('compact')
    useLayoutStore.getState().toggleDockPanel('right', 'ai')

    useLayoutStore.getState().setZenModeActive(true)
    expect(useLayoutStore.getState().overlayDock).toBe('right')

    useLayoutStore.getState().setZenModeActive(false)
    expect(useLayoutStore.getState().overlayDock).toBe('right')
    expect(useLayoutStore.getState().rightBar.activePanelId).toBe('ai')
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

  it('keeps only one overlay Dock open in compact mode', () => {
    useLayoutStore.getState().setViewportMode('compact')
    useLayoutStore.getState().toggleDockPanel('right', 'ai')

    expect(useLayoutStore.getState().overlayDock).toBe('right')
    expect(useLayoutStore.getState().leftBar.visible).toBe(true)
    expect(useLayoutStore.getState().rightBar).toMatchObject({
      activePanelId: 'ai',
      visible: true,
    })

    useLayoutStore.getState().toggleDockPanel('left', 'search')
    expect(useLayoutStore.getState().overlayDock).toBe('left')
    expect(useLayoutStore.getState().rightBar.visible).toBe(true)
  })

  it('closes a compact left Dock after a selection even when the selected id is unchanged', () => {
    useLayoutStore.getState().setViewportMode('compact')
    useLayoutStore.getState().toggleDockPanel('left', 'explorer')

    expect(closeCompactLeftDockAfterSelection()).toBe(true)
    expect(useLayoutStore.getState().overlayDock).toBeNull()
    expect(closeCompactLeftDockAfterSelection()).toBe(false)
  })

  it('tracks the latest pixel size without changing panel visibility', () => {
    useLayoutStore.getState().setDockSize('right', 311.6)

    expect(useLayoutStore.getState().rightBar).toEqual({
      activePanelId: 'toc',
      size: 312,
      visible: true,
    })
  })

  it('still synchronizes real dock resize and collapse events outside Zen Mode', () => {
    useLayoutStore.getState().syncDockPanelFromResize('left', 0)
    useLayoutStore.getState().syncDockPanelFromResize('right', 311.6)

    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
    expect(useLayoutStore.getState().rightBar).toEqual({
      activePanelId: 'toc',
      size: 312,
      visible: true,
    })
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

  it('closes overlays that become invalid after a breakpoint change', () => {
    useLayoutStore.getState().setViewportMode('compact')
    useLayoutStore.getState().toggleDockPanel('left', 'explorer')
    expect(useLayoutStore.getState().overlayDock).toBe('left')

    useLayoutStore.getState().setViewportMode('medium')
    expect(useLayoutStore.getState().overlayDock).toBeNull()

    useLayoutStore.getState().setViewportMode('compact')
    useLayoutStore.getState().toggleDockPanel('right', 'toc')
    useLayoutStore.getState().setViewportMode('wide')
    expect(useLayoutStore.getState().overlayDock).toBeNull()
  })
})

describe('Dock restart preferences', () => {
  it('restores closed panels, but never restores Zen or responsive overlays', async () => {
    useLayoutStore.getState().setDockPanel('left', 'bookmarks')
    useLayoutStore.getState().setLeftBarVisible(false)
    useLayoutStore.getState().setRightBarVisible(false)
    useLayoutStore.getState().setZenModeActive(true)
    useLayoutStore.getState().setOverlayDock('left')
    vi.resetModules()
    const restored = (await import('./useLayoutStore')).default.getState()
    expect(restored.leftBar).toMatchObject({ activePanelId: 'bookmarks', visible: false })
    expect(restored.rightBar.visible).toBe(false)
    expect(restored.zenModeActive).toBe(false)
    expect(restored.overlayDock).toBeNull()
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
