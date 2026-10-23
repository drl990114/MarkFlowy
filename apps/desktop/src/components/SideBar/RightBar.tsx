import { memo } from 'react'
import { DockPanelRenderer } from './DockPanelRenderer'

export default memo(function RightBar() {
  return <DockPanelRenderer side='right' />
})
