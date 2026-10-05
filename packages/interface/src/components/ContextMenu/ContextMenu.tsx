import type { IShowContextMenuParams } from './useContextMenuStore'
import useContextMenuStore from './useContextMenuStore'
import { memo } from 'react'
import { Menu } from 'zens'

let returnFocus: HTMLElement | null = null
export const showContextMenu = (params: IShowContextMenuParams) => {
  if (!useContextMenuStore.getState().open && typeof document !== 'undefined') {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }
  useContextMenuStore.getState().show(params)
}
export const hideContextMenu = () => useContextMenuStore.getState().hide()

export const ContextMenu = memo(() => {
  const { x, y, items, open } = useContextMenuStore()
  return (
    <Menu
      aria-label='Context menu'
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) hideContextMenu()
      }}
      items={items}
      anchorPoint={{ x, y }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
        returnFocus = null
      }}
    />
  )
})
ContextMenu.displayName = 'ContextMenu'
