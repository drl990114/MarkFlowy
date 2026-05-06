import type { IShowContextMenuParams } from './useContextMenuStore'
import useContextMenuStore from './useContextMenuStore'
import React, { memo, useEffect } from 'react'
import { Menu, useMenuStore } from 'zens'

export const showContextMenu = (params: IShowContextMenuParams) => {
  const { show } = useContextMenuStore.getState()
  show(params)
}

export const hideContextMenu = () => {
  useContextMenuStore.getState().hide()
}

export const ContextMenu = memo(() => {
  const { x, y, items, open } = useContextMenuStore()
  const menu = useMenuStore()

  useEffect(() => {
    if (open) {
      menu.show()
    }
  }, [x, y, items, open, menu])

  const anchorRect = { x, y }

  return <Menu style={{ zIndex: 11 }} store={menu} items={items} getAnchorRect={() => anchorRect} onClose={hideContextMenu}></Menu>
})

ContextMenu.displayName = 'ContextMenu'
