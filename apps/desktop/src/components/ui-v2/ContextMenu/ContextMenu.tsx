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
import { commandRegistry } from '@/commands'
import { useCommandKeybinding } from '@/commands/useCommandShortcut'
import { ShortcutKeys } from '@/components/ShortcutKeys'
import { Kbd } from '@/components/ui/kbd'
import { useTranslation } from '@/i18n'
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
    }

    if (resolved.children) resolved.children = resolveMenuItems(resolved.children)

    return resolved
  })
}

let showRequest = 0

function MenuShortcut({
  commandId,
  shortcut,
}: Pick<DesktopMenuGroupType, 'commandId' | 'shortcut'>) {
  const binding = useCommandKeybinding(commandId ?? '')
  if (!shortcut && !binding?.keys.length) return null

  return (
    <ContextMenuShortcut>
      {shortcut ? <Kbd>{shortcut}</Kbd> : binding ? <ShortcutKeys keys={binding.keys} /> : null}
    </ContextMenuShortcut>
  )
}

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

function MenuItems({
  items,
  onAction,
  path = 'root',
}: {
  items: DesktopMenuItemData[]
  onAction: (handler: DesktopMenuGroupType['handler']) => void
  path?: string
}) {
  return items.map((item, index) => {
    const key = `${path}-${index}`
    if ('type' in item && item.type === 'divider') {
      return <ContextMenuSeparator key={key} />
    }

    const menuItem = item as DesktopMenuGroupType
    const Icon = menuItem.icon
    const checkedIcon = menuItem.checked ? menuItem.checkedIcon : undefined
    const icon = (
      <span className='flex size-3.5 shrink-0 items-center justify-center' aria-hidden='true'>
        {checkedIcon ?? (Icon ? <Icon aria-hidden='true' size={14} strokeWidth={1.75} /> : null)}
      </span>
    )
    const label = <span className='min-w-0 flex-1 truncate'>{menuItem.label}</span>
    const shortcut = <MenuShortcut commandId={menuItem.commandId} shortcut={menuItem.shortcut} />

    if (menuItem.children?.length) {
      return (
        <ContextMenuSub key={`${key}-${menuItem.value}`}>
          <ContextMenuSubTrigger disabled={menuItem.disabled}>
            {icon}
            {label}
            {shortcut}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <MenuItems
              items={menuItem.children}
              onAction={onAction}
              path={`${key}-${menuItem.value}`}
            />
          </ContextMenuSubContent>
        </ContextMenuSub>
      )
    }

    if (menuItem.checked !== undefined) {
      return (
        <ContextMenuCheckboxItem
          checked={menuItem.checked}
          className={checkedIcon ? '[&_[data-slot=context-menu-item-indicator]]:hidden' : undefined}
          disabled={menuItem.disabled}
          key={`${key}-${menuItem.value}`}
          onSelect={() => onAction(menuItem.handler)}
        >
          {checkedIcon || (Icon && !menuItem.checked) ? (
            <span className='absolute left-2'>{icon}</span>
          ) : null}
          {label}
          {shortcut}
        </ContextMenuCheckboxItem>
      )
    }

    return (
      <ContextMenuItem
        disabled={menuItem.disabled}
        key={`${key}-${menuItem.value}`}
        onSelect={() => onAction(menuItem.handler)}
      >
        {icon}
        {label}
        {shortcut}
      </ContextMenuItem>
    )
  })
}

export const ContextMenu = memo(() => {
  const { items, open, x, y } = useContextMenuStore()
  const { t } = useTranslation()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const radixOpenRef = useRef(false)
  const pendingActionRef = useRef<DesktopMenuGroupType['handler']>(undefined)
  const [radixOpen, setRadixOpen] = useState(false)
  const resolvedItems = useMemo(() => resolveMenuItems(items), [items])
  const handleAction = useCallback((handler: DesktopMenuGroupType['handler']) => {
    pendingActionRef.current = handler
  }, [])
  const handleCloseAutoFocus = useCallback(() => {
    const action = pendingActionRef.current
    pendingActionRef.current = undefined
    // Let Radix finish restoring focus and removing its focus scope before an
    // action mounts an input or dialog. Otherwise close autofocus blurs it.
    if (action) queueMicrotask(action)
  }, [])

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
      <ContextMenuContent aria-label={t('contextmenu.label')} onCloseAutoFocus={handleCloseAutoFocus}>
        <MenuItems items={resolvedItems} onAction={handleAction} />
      </ContextMenuContent>
    </ContextMenuPrimitive>
  )
})
