import type { IShowContextMenuParams } from '@/stores/useContextMenuStore'
import useContextMenuStore from '@/stores/useContextMenuStore'
import { Menu } from 'zens'
import { useEffect } from 'react'

const CONTEXT_MENU_ID = 'mf-context-menu'

export const showContextMenu = (params: IShowContextMenuParams) => {
  const { show } = useContextMenuStore.getState()
  show(params)
}

export const hideContextMenu = () => {
  useContextMenuStore.getState().hide()
}

export const ContextMenu = () => {
  const { x, y, items, show, open } = useContextMenuStore()
  const handleClick = () => {
    useContextMenuStore.getState().hide()
  }

  useEffect(() => {
    window.addEventListener('contextmenu', handleClick, true)

    return () => {
      window.removeEventListener('contextmenu', handleClick)
    }
  }, [])

  useEffect(() => {
    if (open) {
      let fixedX = x
      let fixedY = y
      const rect = document.getElementById(CONTEXT_MENU_ID)!.getBoundingClientRect()
      const { width, height } = rect

      if (y + height > window.innerHeight) {
        fixedY = window.innerHeight - height - 10
      }
      if (x + width > window.innerWidth) {
        fixedX = window.innerWidth - width - 10
      }

      show({
        x: fixedX,
        y: fixedY,
        items,
      })
    }
  }, [x, y, items, open, show])

  return (
    <Menu
      open
      id={CONTEXT_MENU_ID}
      items={items}
      style={{
        position: 'fixed',
        top: `${y}px`,
        left: `${x}px`,
        zIndex: 99,
        minWidth: 140,
      }}
      onClose={hideContextMenu}
    ></Menu>
  )
}
