import type { RIGHTBARITEMKEYS } from '@/constants'
import { memo, type ReactNode } from 'react'
import { DockPanelRenderer } from './DockPanelRenderer'

export default memo(function SideBar() {
  return <DockPanelRenderer side='left' />
})

/** @deprecated Dock rendering now uses DockPanelDefinition; retained for extension compatibility. */
export interface RightBarItem {
  title: RIGHTBARITEMKEYS
  key: RIGHTBARITEMKEYS
  icon: ReactNode
  components: ReactNode
}
