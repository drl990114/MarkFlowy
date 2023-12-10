import type { IShowContextMenuParams } from '@/stores/useContextMenuStore'
import useContextMenuStore from '@/stores/useContextMenuStore'
import { Menu } from '@markflowy/components'
import { useEffect } from 'react'

export const showContextMenu = (params: IShowContextMenuParams) => {
  useContextMenuStore.getState().show(params)
}

export const hideContextMenu = () => {
  useContextMenuStore.getState().hide()
}

export const ContextMenu = () => {
  const { x, y, items } = useContextMenuStore()
  const open = x !== -9999

  useEffect(() => {
    const handleClick = () => {
      useContextMenuStore.getState().hide()
    }

    window.addEventListener('contextmenu', handleClick, true)

    return () => {
      window.removeEventListener('contextmenu', handleClick)
    }
  }, [])

  return (
    <div
      style={{ position: 'fixed', top: `${y}px`, left: `${x}px`, zIndex: 99 }}
    >
      {open ? (
        <Menu
          open
          items={items}
          style={{
            position: 'fixed',
            top: `${y}px`,
            left: `${x}px`,
            zIndex: 99,
          }}
          onClose={hideContextMenu}
        ></Menu>
      ) : null}
    </div>
  )
}
