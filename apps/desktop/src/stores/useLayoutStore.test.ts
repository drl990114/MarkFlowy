import { beforeEach, describe, expect, it } from 'vitest'
import useLayoutStore, {
  closeCompactLeftDockAfterSelection,
  DOCK_PREFERENCES_STORAGE_KEY,
} from './useLayoutStore'

beforeEach(() => {
  localStorage.removeItem(DOCK_PREFERENCES_STORAGE_KEY)
  useLayoutStore.setState({
    leftBar: { activePanelId: 'explorer', size: 240, visible: true },
    rightBar: { activePanelId: 'toc', size: 280, visible: true },
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
      version: 1,
      left: { activePanelId: 'bookmarks', size: 240 },
      right: { activePanelId: 'toc', size: 420 },
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
