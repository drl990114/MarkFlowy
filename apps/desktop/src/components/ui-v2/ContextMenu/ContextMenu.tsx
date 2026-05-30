import { commandRegistry, keybindingRegistry } from '@/commands'
import type { IShowContextMenuParams } from '@/stores/useContextMenuStore'
import type { MenuItemData, MenuGroupType } from 'zens'
import useContextMenuStore from '@/stores/useContextMenuStore'
import { memo, useEffect, useMemo } from 'react'
import { Menu, useMenuStore } from 'zens'

function resolveMenuItems(items: MenuItemData[]): MenuItemData[] {
  return items.map((item) => {
    if ('type' in item && item.type === 'divider') return item

    const groupItem = item as MenuGroupType
    const resolved: MenuGroupType = { ...groupItem }

    if (groupItem.commandId) {
      if (!resolved.handler) {
        const cmdId = groupItem.commandId
        resolved.handler = () => commandRegistry.execute(cmdId)
      }

      if (!resolved.shortcut) {
        const shortcut = keybindingRegistry.formatKeybinding(groupItem.commandId)
        if (shortcut) {
          resolved.shortcut = shortcut
        }
      }
    }

    if (resolved.children) {
      resolved.children = resolveMenuItems(resolved.children)
    }

    return resolved
  })
}

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

  const resolvedItems = useMemo(() => resolveMenuItems(items), [items])

  useEffect(() => {
    if (open) {
      menu.show()
    }
  }, [x, y, items, open, menu, show])

  const anchorRect = { x, y }

  return <Menu style={{ zIndex: 11 }} store={menu} items={resolvedItems} getAnchorRect={() => anchorRect} onClose={hideContextMenu}></Menu>
})
