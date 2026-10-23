import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { isRecord, localStateStorage } from './persistStorage'

export type DockSide = 'left' | 'right'
export type DockPanelId = 'explorer' | 'search' | 'bookmarks' | 'toc' | 'ai'
// Retain the aliases for existing settings consumers; panels are no longer side-specific.
export type LeftDockPanelId = DockPanelId
export type RightDockPanelId = DockPanelId
export type DockPanelOrder = Record<DockSide, DockPanelId[]>
export type DockStartup = 'restore' | DockPanelId
export type LeftDockStartup = DockStartup
export type RightDockStartup = DockStartup

export const DEFAULT_DOCK_PANEL_ORDER: DockPanelOrder = {
  left: ['explorer', 'search', 'bookmarks'],
  right: ['toc', 'ai'],
}
export const DEFAULT_LEFT_DOCK_SIZE = 240
export const DEFAULT_RIGHT_DOCK_SIZE = 280
export const MIN_LEFT_DOCK_SIZE = 180
export const MAX_LEFT_DOCK_SIZE = 360
export const MIN_RIGHT_DOCK_SIZE = 220
export const MAX_RIGHT_DOCK_SIZE = 420
export const DOCK_PREFERENCES_STORAGE_KEY = 'mf:desktop:dock-preferences:v1'

export type DockLayoutItem = {
  visible: boolean
  activePanelId: DockPanelId | null
  size: number
}
export type DockProfile = { leftBar: DockLayoutItem; rightBar: DockLayoutItem }
type DockPreferences = Pick<LayoutStore, 'panelOrder' | 'leftBar' | 'rightBar' | 'leftStartup' | 'rightStartup' | 'documentDocks'>
const dockSides: readonly DockSide[] = ['left', 'right']

export function isDockPanelId(value: unknown): value is DockPanelId {
  return value === 'explorer' || value === 'search' || value === 'bookmarks' || value === 'toc' || value === 'ai'
}

export function isDockPanelAvailable(panelId: DockPanelId, hasWorkspace: boolean): boolean {
  return hasWorkspace || (panelId !== 'explorer' && panelId !== 'search')
}

export function getDockPanelSide(panelOrder: DockPanelOrder, panelId: DockPanelId): DockSide | undefined {
  return dockSides.find((side) => panelOrder[side].includes(panelId))
}

export function getAvailableDockPanelIds(panelOrder: DockPanelOrder, side: DockSide, hasWorkspace: boolean): DockPanelId[] {
  return panelOrder[side].filter((panelId) => isDockPanelAvailable(panelId, hasWorkspace))
}

function normalizePanelOrder(value: unknown): DockPanelOrder {
  const saved = isRecord(value) ? value : {}
  const order: DockPanelOrder = { left: [], right: [] }
  const seen = new Set<DockPanelId>()
  for (const side of dockSides) {
    const ids = saved[side]
    if (!Array.isArray(ids)) continue
    for (const id of ids) {
      if (!isDockPanelId(id) || seen.has(id)) continue
      seen.add(id)
      order[side].push(id)
    }
  }
  for (const side of dockSides) {
    for (const id of DEFAULT_DOCK_PANEL_ORDER[side]) {
      if (seen.has(id)) continue
      seen.add(id)
      order[side].push(id)
    }
  }
  return order
}

function clampDockSize(side: DockSide, size: unknown): number {
  const fallback = side === 'left' ? DEFAULT_LEFT_DOCK_SIZE : DEFAULT_RIGHT_DOCK_SIZE
  if (typeof size !== 'number' || !Number.isFinite(size)) return fallback
  const min = side === 'left' ? MIN_LEFT_DOCK_SIZE : MIN_RIGHT_DOCK_SIZE
  const max = side === 'left' ? MAX_LEFT_DOCK_SIZE : MAX_RIGHT_DOCK_SIZE
  return Math.min(max, Math.max(min, Math.round(size)))
}

function normalizeDock(value: unknown, side: DockSide, order: DockPanelOrder, hasWorkspace: boolean): DockLayoutItem {
  const saved = isRecord(value) ? value : {}
  const available = getAvailableDockPanelIds(order, side, hasWorkspace)
  const activePanelId = isDockPanelId(saved.activePanelId) && available.includes(saved.activePanelId)
    ? saved.activePanelId
    : available[0] ?? null
  return {
    activePanelId,
    visible: activePanelId !== null && (typeof saved.visible === 'boolean' ? saved.visible : hasWorkspace),
    size: clampDockSize(side, saved.size),
  }
}

function normalizeStartup(value: unknown, side: DockSide, order: DockPanelOrder): DockStartup {
  return isDockPanelId(value) && order[side].includes(value) ? value : 'restore'
}

function normalizePreferences(value: unknown): DockPreferences {
  const saved = isRecord(value) ? value : {}
  const documents = isRecord(saved.documentDocks) ? saved.documentDocks : {}
  const panelOrder = normalizePanelOrder(saved.panelOrder)
  return {
    panelOrder,
    documentDocks: {
      leftBar: normalizeDock(documents.leftBar, 'left', panelOrder, false),
      rightBar: normalizeDock(documents.rightBar, 'right', panelOrder, false),
    },
    leftBar: normalizeDock(saved.leftBar, 'left', panelOrder, true),
    rightBar: normalizeDock(saved.rightBar, 'right', panelOrder, true),
    leftStartup: normalizeStartup(saved.leftStartup, 'left', panelOrder),
    rightStartup: normalizeStartup(saved.rightStartup, 'right', panelOrder),
  }
}

function repairProfile(profile: DockProfile, order: DockPanelOrder, hasWorkspace: boolean, fallbackOrder = order): void {
  for (const side of dockSides) {
    const dock = side === 'left' ? profile.leftBar : profile.rightBar
    const available = getAvailableDockPanelIds(order, side, hasWorkspace)
    if (dock.activePanelId === null || !available.includes(dock.activePanelId)) {
      dock.activePanelId = fallbackOrder[side].find((id) => available.includes(id)) ?? available[0] ?? null
    }
    if (dock.activePanelId === null) dock.visible = false
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
    immer((set, get) => ({
      ...normalizePreferences(undefined),
      zenModeActive: false,
      hasWorkspace: true,
      workspaceDocks: undefined,
      setWorkspaceContext: (hasWorkspace) => set((state) => {
        if (state.hasWorkspace === hasWorkspace) return
        const previous = { leftBar: { ...state.leftBar }, rightBar: { ...state.rightBar } }
        const next = hasWorkspace ? state.workspaceDocks : state.documentDocks
        if (hasWorkspace) state.documentDocks = previous
        else state.workspaceDocks = previous
        if (next) {
          state.leftBar = { ...next.leftBar }
          state.rightBar = { ...next.rightBar }
        }
        state.hasWorkspace = hasWorkspace
        repairProfile(state, state.panelOrder, hasWorkspace)
      }),

      openExplorer: () => get().openDockPanel('explorer'),
      openDockPanel: (panelId) => set((state) => {
        if (!isDockPanelId(panelId) || !isDockPanelAvailable(panelId, state.hasWorkspace)) return
        const side = getDockPanelSide(state.panelOrder, panelId)
        if (!side) return
        const dock = side === 'left' ? state.leftBar : state.rightBar
        dock.activePanelId = panelId
        dock.visible = true
      }),

      moveDockPanel: (panelId, targetSide, targetIndex) => set((state) => {
        if (!isDockPanelId(panelId) || !isDockPanelAvailable(panelId, state.hasWorkspace)) return
        const sourceSide = getDockPanelSide(state.panelOrder, panelId)
        if (!sourceSide) return
        const sourceIndex = state.panelOrder[sourceSide].indexOf(panelId)
        const boundary = typeof targetIndex === 'number' && Number.isFinite(targetIndex)
          ? Math.max(0, Math.min(state.panelOrder[targetSide].length, Math.trunc(targetIndex)))
          : state.panelOrder[targetSide].length
        const insertionIndex = sourceSide === targetSide && boundary > sourceIndex ? boundary - 1 : boundary
        if (sourceSide === targetSide && insertionIndex === sourceIndex) return
        const fallbackOrder = { ...state.panelOrder, [sourceSide]: [
          ...state.panelOrder[sourceSide].slice(sourceIndex + 1),
          ...state.panelOrder[sourceSide].slice(0, sourceIndex).reverse(),
        ] }
        state.panelOrder[sourceSide].splice(sourceIndex, 1)
        state.panelOrder[targetSide].splice(insertionIndex, 0, panelId)
        if (sourceSide === targetSide) return
        repairProfile(state, state.panelOrder, state.hasWorkspace, fallbackOrder)
        repairProfile(state.documentDocks, state.panelOrder, false, fallbackOrder)
        if (state.workspaceDocks) repairProfile(state.workspaceDocks, state.panelOrder, true, fallbackOrder)
        const targetDock = targetSide === 'left' ? state.leftBar : state.rightBar
        targetDock.activePanelId = panelId
        targetDock.visible = true
        state.leftStartup = normalizeStartup(state.leftStartup, 'left', state.panelOrder)
        state.rightStartup = normalizeStartup(state.rightStartup, 'right', state.panelOrder)
      }),

      resetDockLayout: () => set((state) => {
        state.panelOrder = normalizePanelOrder(undefined)
        repairProfile(state, state.panelOrder, state.hasWorkspace)
        repairProfile(state.documentDocks, state.panelOrder, false)
        if (state.workspaceDocks) repairProfile(state.workspaceDocks, state.panelOrder, true)
        state.leftStartup = normalizeStartup(state.leftStartup, 'left', state.panelOrder)
        state.rightStartup = normalizeStartup(state.rightStartup, 'right', state.panelOrder)
      }),

      setLeftBarVisible: (visible) => set((state) => {
        state.leftBar.visible = visible && state.leftBar.activePanelId !== null
      }),
      setRightBarVisible: (visible) => set((state) => {
        state.rightBar.visible = visible && state.rightBar.activePanelId !== null
      }),
      setDockPanel: (side, panelId) => set((state) => {
        if (!isDockPanelId(panelId) || !state.panelOrder[side].includes(panelId) || !isDockPanelAvailable(panelId, state.hasWorkspace)) return
        const dock = side === 'left' ? state.leftBar : state.rightBar
        dock.activePanelId = panelId
      }),
      setDockSize: (side, size) => set((state) => {
        const roundedSize = clampDockSize(side, size)
        const dock = side === 'left' ? state.leftBar : state.rightBar
        if (dock.size !== roundedSize) dock.size = roundedSize
      }),
      syncDockPanelFromResize: (side, size) => set((state) => {
        // Zen Mode's temporary 0px measurements must not close the saved dock.
        if (state.zenModeActive || !Number.isFinite(size) || size < 0) return
        const dock = side === 'left' ? state.leftBar : state.rightBar
        if (!dock.visible) return
        if (size === 0) dock.visible = false
        else {
          const roundedSize = clampDockSize(side, size)
          if (dock.size !== roundedSize) dock.size = roundedSize
        }
      }),
      toggleDockPanel: (side, panelId) => set((state) => {
        if (!isDockPanelId(panelId) || !state.panelOrder[side].includes(panelId) || !isDockPanelAvailable(panelId, state.hasWorkspace)) return
        const dock = side === 'left' ? state.leftBar : state.rightBar
        const isActive = dock.activePanelId === panelId
        dock.activePanelId = panelId
        dock.visible = !(dock.visible && isActive)
      }),
      setStartupPanel: (side, panel) => set((state) => {
        if (panel !== 'restore' && (!isDockPanelId(panel) || !state.panelOrder[side].includes(panel))) return
        if (side === 'left') state.leftStartup = panel
        else state.rightStartup = panel
      }),
      setZenModeActive: (active) => set((state) => { state.zenModeActive = active }),
      toggleZenMode: () => set((state) => { state.zenModeActive = !state.zenModeActive }),
    })),
    {
      name: DOCK_PREFERENCES_STORAGE_KEY,
      version: 3,
      storage: dockStorage,
      partialize: ({ panelOrder, leftBar, rightBar, leftStartup, rightStartup, hasWorkspace, workspaceDocks, documentDocks }) => ({
        panelOrder,
        leftBar: !hasWorkspace && workspaceDocks ? workspaceDocks.leftBar : leftBar,
        rightBar: !hasWorkspace && workspaceDocks ? workspaceDocks.rightBar : rightBar,
        documentDocks: hasWorkspace ? documentDocks : { leftBar, rightBar },
        leftStartup,
        rightStartup,
      }),
      migrate: (saved) => normalizePreferences(saved),
      merge: (saved, current) => {
        const preferences = normalizePreferences(saved)
        for (const side of dockSides) {
          const startup = side === 'left' ? preferences.leftStartup : preferences.rightStartup
          const dock = side === 'left' ? preferences.leftBar : preferences.rightBar
          if (startup !== 'restore') { dock.activePanelId = startup; dock.visible = true }
        }
        return { ...current, ...preferences }
      },
    },
  ),
)

export type LayoutStore = DockProfile & {
  panelOrder: DockPanelOrder
  hasWorkspace: boolean
  documentDocks: DockProfile
  workspaceDocks?: DockProfile
  setWorkspaceContext: (hasWorkspace: boolean) => void
  leftStartup: DockStartup
  rightStartup: DockStartup
  setStartupPanel: (side: DockSide, panel: DockStartup) => void
  zenModeActive: boolean
  openExplorer: () => void
  openDockPanel: (panelId: DockPanelId) => void
  /** targetIndex is an insertion boundary in the target list before removing the source. */
  moveDockPanel: (panelId: DockPanelId, targetSide: DockSide, targetIndex?: number) => void
  resetDockLayout: () => void
  setLeftBarVisible: (visible: boolean) => void
  setRightBarVisible: (visible: boolean) => void
  setDockPanel: (side: DockSide, panelId: DockPanelId) => void
  setDockSize: (side: DockSide, size: number) => void
  syncDockPanelFromResize: (side: DockSide, size: number) => void
  toggleDockPanel: (side: DockSide, panelId: DockPanelId | null) => void
  setZenModeActive: (active: boolean) => void
  toggleZenMode: () => void
}

export default useLayoutStore
