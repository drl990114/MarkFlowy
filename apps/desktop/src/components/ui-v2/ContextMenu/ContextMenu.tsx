import {
  ContextMenu as ContextMenuPrimitive,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { commandRegistry, keybindingRegistry } from '@/commands'
import type {
  DesktopMenuGroupType,
  DesktopMenuItemData,
  IShowContextMenuParams,
} from '@/stores/useContextMenuStore'
import useContextMenuStore from '@/stores/useContextMenuStore'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

function resolveMenuItems(items: DesktopMenuItemData[]): DesktopMenuItemData[] {
  return items.map((item) => {
    if ('type' in item && item.type === 'divider') return item

    const groupItem = item as DesktopMenuGroupType
    const resolved: DesktopMenuGroupType = { ...groupItem }

    if (groupItem.commandId) {
      if (!resolved.handler) {
        const commandId = groupItem.commandId
        resolved.handler = () => commandRegistry.execute(commandId)
      }

      if (!resolved.shortcut) {
        const shortcut = keybindingRegistry.formatKeybinding(groupItem.commandId)
        if (shortcut) resolved.shortcut = shortcut
      }
    }

    if (resolved.children) resolved.children = resolveMenuItems(resolved.children)

    return resolved
  })
}

let showRequest = 0

export const showContextMenu = (params: IShowContextMenuParams) => {
  const request = ++showRequest
  const store = useContextMenuStore.getState()

  if (!store.open) {
    store.show(params)
    return
  }

  // A controlled Radix context menu needs a closed frame before it can acquire
  // a new virtual pointer anchor. Preserve the imperative API while making
  // repeated requests deterministic, including requests at the same point.
  store.hide()
  queueMicrotask(() => {
    if (request === showRequest) useContextMenuStore.getState().show(params)
  })
}

export const hideContextMenu = () => {
  showRequest += 1
  useContextMenuStore.getState().hide()
}

function MenuItems({ items, path = 'root' }: { items: DesktopMenuItemData[]; path?: string }) {
  return items.map((item, index) => {
    const key = `${path}-${index}`
    if ('type' in item && item.type === 'divider') {
      return <ContextMenuSeparator key={key} />
    }

    const menuItem = item as DesktopMenuGroupType
    const label = <span className='min-w-0 flex-1 truncate'>{menuItem.label}</span>
    const shortcut = menuItem.shortcut ? (
      <ContextMenuShortcut>{menuItem.shortcut}</ContextMenuShortcut>
    ) : null

    if (menuItem.children?.length) {
      return (
        <ContextMenuSub key={`${key}-${menuItem.value}`}>
          <ContextMenuSubTrigger disabled={menuItem.disabled}>
            <span className='size-3.5 shrink-0' aria-hidden='true' />
            {label}
            {shortcut}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <MenuItems items={menuItem.children} path={`${key}-${menuItem.value}`} />
          </ContextMenuSubContent>
        </ContextMenuSub>
      )
    }

    if (menuItem.checked !== undefined) {
      return (
        <ContextMenuCheckboxItem
          checked={menuItem.checked}
          disabled={menuItem.disabled}
          key={`${key}-${menuItem.value}`}
          onSelect={menuItem.handler}
        >
          {label}
          {shortcut}
        </ContextMenuCheckboxItem>
      )
    }

    return (
      <ContextMenuItem
        disabled={menuItem.disabled}
        key={`${key}-${menuItem.value}`}
        onSelect={menuItem.handler}
      >
        <span className='size-3.5 shrink-0' aria-hidden='true' />
        {label}
        {shortcut}
      </ContextMenuItem>
    )
  })
}

export const ContextMenu = memo(() => {
  const { items, open, x, y } = useContextMenuStore()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const radixOpenRef = useRef(false)
  const [radixOpen, setRadixOpen] = useState(false)
  const resolvedItems = useMemo(() => resolveMenuItems(items), [items])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    radixOpenRef.current = nextOpen
    setRadixOpen(nextOpen)

    if (!nextOpen && useContextMenuStore.getState().open) hideContextMenu()
  }, [])

  useEffect(() => {
    if (!open) {
      radixOpenRef.current = false
      setRadixOpen(false)
      return
    }

    let frame = 0
    const trigger = triggerRef.current
    const dispatchOpen = () => {
      if (!trigger || !useContextMenuStore.getState().open) return
      const MouseEventConstructor = trigger.ownerDocument.defaultView?.MouseEvent ?? MouseEvent
      trigger.dispatchEvent(
        new MouseEventConstructor('contextmenu', {
          bubbles: true,
          button: 2,
          buttons: 2,
          cancelable: true,
          clientX: x,
          clientY: y,
        }),
      )
    }

    if (radixOpenRef.current) {
      radixOpenRef.current = false
      setRadixOpen(false)
      frame = window.requestAnimationFrame(dispatchOpen)
    } else {
      dispatchOpen()
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [items, open, x, y])

  return (
    <ContextMenuPrimitive open={radixOpen} onOpenChange={handleOpenChange}>
      <ContextMenuTrigger
        ref={triggerRef}
        aria-hidden='true'
        style={{
          height: 0,
          left: x,
          pointerEvents: 'none',
          position: 'fixed',
          top: y,
          width: 0,
        }}
      />
      <ContextMenuContent aria-label='Context menu'>
        <MenuItems items={resolvedItems} />
      </ContextMenuContent>
    </ContextMenuPrimitive>
  )
})
