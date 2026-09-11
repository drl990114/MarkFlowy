import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { isRecord, localStateStorage } from './persistStorage'

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

export type LeftDockStartup = 'restore' | LeftDockPanelId
export type RightDockStartup = 'restore' | RightDockPanelId

type DockPreferences = Pick<LayoutStore, 'leftBar' | 'rightBar' | 'leftStartup' | 'rightStartup'>

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

function normalizePreferences(value: unknown): DockPreferences {
  const saved = isRecord(value) ? value : {}
  const left = isRecord(saved.leftBar) ? saved.leftBar : {}
  const right = isRecord(saved.rightBar) ? saved.rightBar : {}
  return {
    leftBar: {
      visible: typeof left.visible === 'boolean' ? left.visible : true,
      activePanelId: isLeftDockPanelId(left.activePanelId) ? left.activePanelId : 'explorer',
      size: clampDockSize('left', left.size),
    },
    rightBar: {
      visible: typeof right.visible === 'boolean' ? right.visible : true,
      activePanelId: isRightDockPanelId(right.activePanelId) ? right.activePanelId : 'toc',
      size: clampDockSize('right', right.size),
    },
    leftStartup: isLeftDockPanelId(saved.leftStartup) ? saved.leftStartup : 'restore',
    rightStartup: isRightDockPanelId(saved.rightStartup) ? saved.rightStartup : 'restore',
  }
}

// The previous implementation stored a raw object, before using Zustand's envelope.
const dockStorage = createJSONStorage<DockPreferences>(() => ({
  ...localStateStorage,
  getItem: (name) => {
    const raw = localStateStorage.getItem(name)
    if (typeof raw !== 'string') return null
    try {
      const value: unknown = JSON.parse(raw)
      if (isRecord(value) && value.version === 1 && !('state' in value)) {
        return JSON.stringify({ state: { leftBar: value.left, rightBar: value.right }, version: 1 })
      }
      return raw
    } catch {
      return null
    }
  },
}))

const useLayoutStore = create<LayoutStore>()(
  persist(
    immer((set) => {
      return {
        ...normalizePreferences(undefined),
        overlayDock: null,
        viewportMode: 'wide',
        zenModeActive: false,

        openExplorer: () => {
          set((state) => {
            state.leftBar.activePanelId = 'explorer'
            state.leftBar.visible = true
            if (state.viewportMode === 'compact') state.overlayDock = 'left'
          })
        },

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
        },

        setDockSize: (side: DockSide, size: number) => {
          set((state) => {
            const roundedSize = clampDockSize(side, size)
            const dock = side === 'left' ? state.leftBar : state.rightBar
            if (dock.size !== roundedSize) dock.size = roundedSize
          })
        },

        syncDockPanelFromResize: (side: DockSide, size: number) => {
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
            }
          })
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
        },

        setStartupPanel: (side, panel) => {
          set((state) => {
            if (side === 'left' && (panel === 'restore' || isLeftDockPanelId(panel))) {
              state.leftStartup = panel
            } else if (side === 'right' && (panel === 'restore' || isRightDockPanelId(panel))) {
              state.rightStartup = panel
            }
          })
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
    {
      name: DOCK_PREFERENCES_STORAGE_KEY,
      version: 2,
      storage: dockStorage,
      partialize: ({ leftBar, rightBar, leftStartup, rightStartup }) => ({
        leftBar,
        rightBar,
        leftStartup,
        rightStartup,
      }),
      migrate: (saved) => normalizePreferences(saved),
      merge: (saved, current) => {
        const preferences = normalizePreferences(saved)
        if (preferences.leftStartup !== 'restore') {
          preferences.leftBar = {
            ...preferences.leftBar,
            activePanelId: preferences.leftStartup,
            visible: true,
          }
        }
        if (preferences.rightStartup !== 'restore') {
          preferences.rightBar = {
            ...preferences.rightBar,
            activePanelId: preferences.rightStartup,
            visible: true,
          }
        }
        return { ...current, ...preferences }
      },
    },
  ),
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
export type LayoutStore = {
  leftStartup: LeftDockStartup
  rightStartup: RightDockStartup
  setStartupPanel: (side: DockSide, panel: LeftDockStartup | RightDockStartup) => void
  leftBar: LayoutItem<LeftDockPanelId>
  rightBar: LayoutItem<RightDockPanelId>
  overlayDock: DockSide | null
  viewportMode: DockViewportMode
  zenModeActive: boolean
  openExplorer: () => void
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
