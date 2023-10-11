import { FLOWYUI_CONTEXT_MENU_ID } from '@/constants/flowy-ui'
import type { MenuItemData } from '@flowy-ui/context-menu'
import type ContextMenu from '@flowy-ui/context-menu'

interface ShowContextMenuParams {
  items: MenuItemData[]
  x: number
  y: number
}

export const showContextMenu = (params: ShowContextMenuParams): ContextMenu => {
  const contextMenuEl = document.getElementById(FLOWYUI_CONTEXT_MENU_ID) as ContextMenu

  contextMenuEl.data = params.items

  contextMenuEl.show_menu(params.x, params.y)

  return contextMenuEl
}
