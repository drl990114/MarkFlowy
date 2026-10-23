import type { LucideIcon } from 'lucide-react'
import {
  BookmarkIcon,
  FilesIcon,
  SearchIcon,
  SparklesIcon,
  TableOfContentsIcon,
} from 'lucide-react'
import {
  DEFAULT_DOCK_PANEL_ORDER,
  getAvailableDockPanelIds,
  type DockPanelId,
  type DockPanelOrder,
  type DockSide,
} from '@/stores/useLayoutStore'

export type DockPanelDefinition = {
  id: DockPanelId
  labelKey: string
  fallbackLabel: string
  icon: LucideIcon
}

export const dockPanels: readonly DockPanelDefinition[] = [
  {
    id: 'explorer',
    labelKey: 'sidebar.explorer',
    fallbackLabel: 'Files',
    icon: FilesIcon,
  },
  {
    id: 'search',
    labelKey: 'sidebar.search',
    fallbackLabel: 'Search',
    icon: SearchIcon,
  },
  {
    id: 'bookmarks',
    labelKey: 'sidebar.bookmarks',
    fallbackLabel: 'Bookmarks',
    icon: BookmarkIcon,
  },
  {
    id: 'toc',
    labelKey: 'sidebar.table_of_contents',
    fallbackLabel: 'Table of Contents',
    icon: TableOfContentsIcon,
  },
  {
    id: 'ai',
    labelKey: 'ai.assistant',
    fallbackLabel: 'AI',
    icon: SparklesIcon,
  },
]

export function getDockPanelDefinition(panelId: DockPanelId): DockPanelDefinition {
  return dockPanels.find((panel) => panel.id === panelId)!
}

export function getDockPanels(
  side: DockSide,
  panelOrder: DockPanelOrder = DEFAULT_DOCK_PANEL_ORDER,
  hasWorkspace = true,
): DockPanelDefinition[] {
  return getAvailableDockPanelIds(panelOrder, side, hasWorkspace).map(getDockPanelDefinition)
}

export const leftDockPanels = getDockPanels('left')
export const rightDockPanels = getDockPanels('right')
