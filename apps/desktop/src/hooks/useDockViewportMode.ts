import { useSyncExternalStore } from 'react'
import type { DockViewportMode } from '@/stores/useLayoutStore'

const COMPACT_QUERY = '(max-width: 719px)'
const MEDIUM_QUERY = '(max-width: 959px)'

export function getDockViewportMode(width: number): DockViewportMode {
  if (width < 720) return 'compact'
  if (width < 960) return 'medium'
  return 'wide'
}

function getSnapshot(): DockViewportMode {
  if (typeof window === 'undefined') return 'wide'
  return getDockViewportMode(window.innerWidth)
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined

  const compactQuery = window.matchMedia(COMPACT_QUERY)
  const mediumQuery = window.matchMedia(MEDIUM_QUERY)
  compactQuery.addEventListener('change', onStoreChange)
  mediumQuery.addEventListener('change', onStoreChange)

  return () => {
    compactQuery.removeEventListener('change', onStoreChange)
    mediumQuery.removeEventListener('change', onStoreChange)
  }
}

export function useDockViewportMode(): DockViewportMode {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'wide')
}
