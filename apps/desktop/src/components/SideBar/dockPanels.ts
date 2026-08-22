import type { LucideIcon } from 'lucide-react'
import {
  BookmarkIcon,
  FilesIcon,
  SearchIcon,
  SparklesIcon,
  TableOfContentsIcon,
} from 'lucide-react'
import type {
  DockPanelId,
  DockSide,
  LeftDockPanelId,
  RightDockPanelId,
} from '@/stores/useLayoutStore'

export type DockPanelDefinition<TPanelId extends DockPanelId = DockPanelId> = {
  id: TPanelId
  dock: DockSide
  labelKey: string
  fallbackLabel: string
  icon: LucideIcon
}

export const leftDockPanels: readonly DockPanelDefinition<LeftDockPanelId>[] = [
  {
    id: 'explorer',
    dock: 'left',
    labelKey: 'sidebar.explorer',
    fallbackLabel: 'Files',
    icon: FilesIcon,
  },
  {
    id: 'search',
    dock: 'left',
    labelKey: 'sidebar.search',
    fallbackLabel: 'Search',
    icon: SearchIcon,
  },
  {
    id: 'bookmarks',
    dock: 'left',
    labelKey: 'sidebar.bookmarks',
    fallbackLabel: 'Bookmarks',
    icon: BookmarkIcon,
  },
]

export const rightDockPanels: readonly DockPanelDefinition<RightDockPanelId>[] = [
  {
    id: 'toc',
    dock: 'right',
    labelKey: 'sidebar.table_of_contents',
    fallbackLabel: 'Table of Contents',
    icon: TableOfContentsIcon,
  },
  {
    id: 'ai',
    dock: 'right',
    labelKey: 'ai.assistant',
    fallbackLabel: 'AI',
    icon: SparklesIcon,
  },
]

export function getDockPanels(side: DockSide) {
  return side === 'left' ? leftDockPanels : rightDockPanels
}
