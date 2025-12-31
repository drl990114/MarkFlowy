import type { IShowContextMenuParams } from '@/stores/useContextMenuStore'
import useContextMenuStore from '@/stores/useContextMenuStore'
import { memo, useEffect } from 'react'
import { Menu, useMenuStore } from 'zens'

export const showContextMenu = (params: IShowContextMenuParams) => {
  const { show } = useContextMenuStore.getState()
  show(params)
}

export const hideContextMenu = () => {
  useContextMenuStore.getState().hide()
}

export const ContextMenu = memo(() => {
  const { x, y, items, show, open } = useContextMenuStore()
  const menu = useMenuStore()

  useEffect(() => {
    if (open) {
      menu.show()
    }
  }, [x, y, items, open, menu, show])

  const anchorRect = { x, y }

  return <Menu style={{ zIndex: 11 }} store={menu} items={items} getAnchorRect={() => anchorRect} onClose={hideContextMenu}></Menu>
})
