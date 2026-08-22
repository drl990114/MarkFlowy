import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type DockSide = 'left' | 'right'

export type LeftDockPanelId = 'explorer' | 'search' | 'bookmarks'
export type RightDockPanelId = 'toc' | 'ai'
export type DockPanelId = LeftDockPanelId | RightDockPanelId
export type DockViewportMode = 'compact' | 'medium' | 'wide'

export const DEFAULT_LEFT_DOCK_SIZE = 240
export const DEFAULT_RIGHT_DOCK_SIZE = 280
export const MIN_LEFT_DOCK_SIZE = 180
export const MAX_LEFT_DOCK_SIZE = 360
export const MIN_RIGHT_DOCK_SIZE = 220
export const MAX_RIGHT_DOCK_SIZE = 420
export const DOCK_PREFERENCES_STORAGE_KEY = 'mf:desktop:dock-preferences:v1'

type DockPreferences = {
  version: 1
  left: Pick<LayoutItem<LeftDockPanelId>, 'activePanelId' | 'size'>
  right: Pick<LayoutItem<RightDockPanelId>, 'activePanelId' | 'size'>
}

function isLeftDockPanelId(value: unknown): value is LeftDockPanelId {
  return value === 'explorer' || value === 'search' || value === 'bookmarks'
}

function isRightDockPanelId(value: unknown): value is RightDockPanelId {
  return value === 'toc' || value === 'ai'
}

function clampDockSize(side: DockSide, size: unknown): number {
  const fallback = side === 'left' ? DEFAULT_LEFT_DOCK_SIZE : DEFAULT_RIGHT_DOCK_SIZE
  if (typeof size !== 'number' || !Number.isFinite(size)) return fallback

  const min = side === 'left' ? MIN_LEFT_DOCK_SIZE : MIN_RIGHT_DOCK_SIZE
  const max = side === 'left' ? MAX_LEFT_DOCK_SIZE : MAX_RIGHT_DOCK_SIZE
  return Math.min(max, Math.max(min, Math.round(size)))
}

function readDockPreferences(): DockPreferences | undefined {
  if (typeof localStorage === 'undefined') return undefined

  try {
    const parsed = JSON.parse(localStorage.getItem(DOCK_PREFERENCES_STORAGE_KEY) ?? 'null')
    if (
      parsed?.version !== 1 ||
      !isLeftDockPanelId(parsed.left?.activePanelId) ||
      !isRightDockPanelId(parsed.right?.activePanelId)
    ) {
      return undefined
    }

    return {
      version: 1,
      left: {
        activePanelId: parsed.left.activePanelId,
        size: clampDockSize('left', parsed.left.size),
      },
      right: {
        activePanelId: parsed.right.activePanelId,
        size: clampDockSize('right', parsed.right.size),
      },
    }
  } catch {
    return undefined
  }
}

function writeDockPreferences(state: LayoutStore): void {
  if (typeof localStorage === 'undefined') return

  const preferences: DockPreferences = {
    version: 1,
    left: {
      activePanelId: state.leftBar.activePanelId,
      size: clampDockSize('left', state.leftBar.size),
    },
    right: {
      activePanelId: state.rightBar.activePanelId,
      size: clampDockSize('right', state.rightBar.size),
    },
  }

  try {
    localStorage.setItem(DOCK_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // A denied or full storage area should not block layout interactions.
  }
}

const useLayoutStore = create(
  immer<LayoutStore>((set, get) => {
    const preferences = readDockPreferences()

    return {
      leftBar: {
        visible: true,
        activePanelId: preferences?.left.activePanelId ?? 'explorer',
        size: preferences?.left.size ?? DEFAULT_LEFT_DOCK_SIZE,
      },
      rightBar: {
        visible: true,
        activePanelId: preferences?.right.activePanelId ?? 'toc',
        size: preferences?.right.size ?? DEFAULT_RIGHT_DOCK_SIZE,
      },
      overlayDock: null,
      viewportMode: 'wide',
      zenModeActive: false,

      setLeftBarVisible: (visible: boolean) => {
        set((state) => {
          state.leftBar.visible = visible
        })
      },

      setRightBarVisible: (visible: boolean) => {
        set((state) => {
          state.rightBar.visible = visible
        })
      },

      setDockPanel: (side: DockSide, panelId: DockPanelId) => {
        set((state) => {
          if (side === 'left') {
            state.leftBar.activePanelId = panelId as LeftDockPanelId
            return
          }

          state.rightBar.activePanelId = panelId as RightDockPanelId
        })
        writeDockPreferences(get())
      },

      setDockSize: (side: DockSide, size: number) => {
        set((state) => {
          const roundedSize = clampDockSize(side, size)
          const dock = side === 'left' ? state.leftBar : state.rightBar
          if (dock.size !== roundedSize) dock.size = roundedSize
        })
        writeDockPreferences(get())
      },

      syncDockPanelFromResize: (side: DockSide, size: number) => {
        let shouldPersistSize = false

        set((state) => {
          // Zen Mode hides dock panels with display: none. ResizeObserver reports that
          // temporary presentation state as 0px, which must not close the saved dock.
          if (state.zenModeActive) return

          const dock = side === 'left' ? state.leftBar : state.rightBar
          const isVisible = size > 0
          const isDocked =
            side === 'left' ? state.viewportMode !== 'compact' : state.viewportMode === 'wide'

          if (isDocked && dock.visible !== isVisible) dock.visible = isVisible

          if (state.viewportMode === 'wide' && isVisible) {
            const roundedSize = clampDockSize(side, size)
            if (dock.size !== roundedSize) dock.size = roundedSize
            shouldPersistSize = true
          }
        })

        if (shouldPersistSize) writeDockPreferences(get())
      },

      setViewportMode: (viewportMode: DockViewportMode) => {
        set((state) => {
          state.viewportMode = viewportMode
          if (
            viewportMode === 'wide' ||
            (viewportMode === 'medium' && state.overlayDock === 'left')
          ) {
            state.overlayDock = null
          }
        })
      },

      setOverlayDock: (overlayDock: DockSide | null) => {
        set((state) => {
          state.overlayDock = overlayDock
        })
      },

      toggleDockPanel: (side: DockSide, panelId: DockPanelId) => {
        set((state) => {
          const dock = side === 'left' ? state.leftBar : state.rightBar
          const usesOverlay =
            state.viewportMode === 'compact' ||
            (state.viewportMode === 'medium' && side === 'right')
          const isActive = dock.activePanelId === panelId

          if (side === 'left') state.leftBar.activePanelId = panelId as LeftDockPanelId
          else state.rightBar.activePanelId = panelId as RightDockPanelId

          if (usesOverlay) {
            state.overlayDock = state.overlayDock === side && isActive ? null : side
            return
          }

          dock.visible = !(dock.visible && isActive)
        })
        writeDockPreferences(get())
      },

      setZenModeActive: (active: boolean) => {
        set((state) => {
          state.zenModeActive = active
        })
      },

      toggleZenMode: () => {
        set((state) => {
          state.zenModeActive = !state.zenModeActive
        })
      },
    }
  }),
)

export function closeCompactLeftDockAfterSelection(): boolean {
  const state = useLayoutStore.getState()
  if (state.viewportMode !== 'compact' || state.overlayDock !== 'left') return false

  state.setOverlayDock(null)
  return true
}

type LayoutItem<TPanelId extends DockPanelId> = {
  visible: boolean
  activePanelId: TPanelId
  size: number
}
type LayoutStore = {
  leftBar: LayoutItem<LeftDockPanelId>
  rightBar: LayoutItem<RightDockPanelId>
  overlayDock: DockSide | null
  viewportMode: DockViewportMode
  zenModeActive: boolean
  setLeftBarVisible: (visible: boolean) => void
  setRightBarVisible: (visible: boolean) => void
  setDockPanel: (side: DockSide, panelId: DockPanelId) => void
  setDockSize: (side: DockSide, size: number) => void
  syncDockPanelFromResize: (side: DockSide, size: number) => void
  setViewportMode: (viewportMode: DockViewportMode) => void
  setOverlayDock: (overlayDock: DockSide | null) => void
  toggleDockPanel: (side: DockSide, panelId: DockPanelId) => void
  setZenModeActive: (active: boolean) => void
  toggleZenMode: () => void
}

export default useLayoutStore
