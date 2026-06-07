import { t } from '@markflowy/i18n'
import { isHTMLElement } from '@ocavue/utils'
import type { EditorView } from '@rme-sdk/core'
import { NodeSelection } from '@rme-sdk/pm/state'
import { useCommands, useExtension, useRemirrorContext } from '@rme-sdk/react-core'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import { Dropdown, type DropdownMenuItem, type MenuItemType } from 'zens'
import { nodeTypeIconMap } from '../../const'
import { LineListExtension } from '../../extensions'
import { createDraggingPreview, setViewDragging } from '../../extensions/NodeIndicator/drag-preview'
import {
  NodeIndicatorExtension,
  NodeIndicatorState,
} from '../../extensions/NodeIndicator/node-indicator-extension'
import { editorZIndex } from '../../theme/z-index'
import { useBlockTypeOptions } from './useBlockTypeOptions'

const MENU_VIEWPORT_PADDING = 8
const MENU_MIN_HEIGHT = 96

type MenuBoundary = HTMLElement | DOMRect

export interface BlockHandlerProps {
  getMenuBoundary?: (editorView: EditorView) => MenuBoundary | null | undefined
}

const getBoundaryRect = (boundary: MenuBoundary): DOMRect => {
  return boundary instanceof HTMLElement ? boundary.getBoundingClientRect() : (boundary as unknown as DOMRect)
}

const updateBlockHandlerMenuHeight = (boundary: MenuBoundary) => {
  const boundaryRect = getBoundaryRect(boundary)
  const menus = Array.from(
    document.querySelectorAll<HTMLElement>('.rme-block-handler-menu'),
  )

  menus.forEach((menu) => {
    const rect = menu.getBoundingClientRect()
    const spaceBelow = boundaryRect.bottom - rect.top - MENU_VIEWPORT_PADDING
    const spaceAbove = rect.bottom - boundaryRect.top - MENU_VIEWPORT_PADDING
    const availableHeight = Math.max(
      MENU_MIN_HEIGHT,
      rect.bottom > boundaryRect.bottom
        ? spaceBelow
        : rect.top < boundaryRect.top
          ? spaceAbove
          : Math.max(spaceBelow, spaceAbove),
    )
    const scrollArea = menu.querySelector<HTMLElement>(':scope > .dropdown-menu-scroll-area')
    if (!scrollArea) return

    scrollArea.style.maxHeight = `${availableHeight}px`
    scrollArea.style.overflowY = scrollArea.scrollHeight > availableHeight ? 'auto' : ''
  })
}

export const BlockHandler = memo(({ getMenuBoundary }: BlockHandlerProps) => {
  const { view: editorView } = useRemirrorContext({ autoUpdate: true })
  const nodeIndicatorExtension = useExtension(NodeIndicatorExtension)
  const state = nodeIndicatorExtension?.getPluginState() as NodeIndicatorState | undefined
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [fixedPosition, setFixedPosition] = useState<{ left: number; top: number } | null>(null)
  const commands = useCommands<LineListExtension>()
  const blockTypeOptions = useBlockTypeOptions(t, commands)
  const triggerRef = useRef<HTMLDivElement>(null)
  const displayStateRef = useRef<NodeIndicatorState | undefined>(state)

  const handleClick = useCallback(() => {
    if (editorView && nodeIndicatorExtension && state && state.pos !== null && state.node) {
      const tr = editorView.state.tr
      tr.setSelection(NodeSelection.create(tr.doc, state.pos))
      editorView.dispatch(tr)
    }
  }, [editorView, nodeIndicatorExtension, state])

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (editorView && state && state.pos !== null && state.node && state.node.isBlock) {
        editorView.dom.classList.add('rme-dragging')

        handleClick()
        const dom = editorView.nodeDOM(state.pos)

        if (dom && isHTMLElement(dom)) {
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move'
          }

          createDraggingPreview(editorView, state, event)
          setViewDragging(editorView, state)
        }
      }
    },
    [editorView, state, handleClick],
  )

  const handleDragEnd = useCallback(() => {
    if (editorView) {
      editorView.dom.classList.remove('rme-dragging')
    }
  }, [editorView])

  const handleBlockTypeChange = useCallback(
    (optionKey: string) => {
      const savedState = displayStateRef.current
      if (!editorView || !savedState || savedState.pos === null || !savedState.node) return

      const option = blockTypeOptions.find((opt) => opt.key === optionKey)
      if (!option) return

      const currentState = editorView.state
      const tr = currentState.tr
      const context = {
        view: editorView,
        pos: savedState.pos,
        node: savedState.node,
        tr,
      }

      let success = false
      if (option.group === 'transform' && option.transform) {
        success = option.transform(context)
      } else if (option.group === 'actions' && option.action) {
        success = option.action(context)
      }

      if (success) {
        setDropdownOpen(false)
      }
    },
    [editorView, blockTypeOptions],
  )

  useEffect(() => {
    if (!dropdownOpen) {
      displayStateRef.current = state
    }
  }, [state, dropdownOpen])

  useEffect(() => {
    if (dropdownOpen) {
      const currentState = displayStateRef.current
      if (currentState?.rect) {
        setFixedPosition({
          left: currentState.rect.left - 38,
          top: currentState.rect.top,
        })
      }
    } else {
      setFixedPosition(null)
    }
  }, [dropdownOpen])

  useLayoutEffect(() => {
    if (!dropdownOpen || !editorView) return

    let frameId = 0
    const scheduleUpdate = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        updateBlockHandlerMenuHeight(getMenuBoundary?.(editorView) ?? editorView.dom)
      })
    }

    scheduleUpdate()

    const mutationObserver = new MutationObserver(scheduleUpdate)
    mutationObserver.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    })

    document.addEventListener('pointermove', scheduleUpdate, true)
    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('scroll', scheduleUpdate, true)

    return () => {
      cancelAnimationFrame(frameId)
      mutationObserver.disconnect()
      document.removeEventListener('pointermove', scheduleUpdate, true)
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('scroll', scheduleUpdate, true)
    }
  }, [dropdownOpen, editorView, getMenuBoundary])

  useEffect(() => {
    if (!dropdownOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return

      const clickedTrigger = !!triggerRef.current?.contains(target)
      const clickedMenu = target instanceof Element && !!target.closest('.rme-block-handler-menu')
      if (clickedTrigger || clickedMenu) {
        return
      }

      setDropdownOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [dropdownOpen])

  const displayState = dropdownOpen ? displayStateRef.current : state

  const transformOptions = useMemo(() => {
    const currentNode = displayState?.node
    if (!currentNode) return []

    return blockTypeOptions.filter(
      (option) =>
        option.group === 'transform' &&
        (!option.isActive || !option.isActive(currentNode)) &&
        (!option.isAvailable || option.isAvailable(currentNode)),
    )
  }, [blockTypeOptions, displayState?.node])

  const actionOptions = useMemo(() => {
    const currentNode = displayState?.node
    if (!currentNode) return []

    return blockTypeOptions.filter(
      (option) =>
        option.group === 'actions' && (!option.isAvailable || option.isAvailable(currentNode)),
    )
  }, [blockTypeOptions, displayState?.node])

  const groupedTransformOptions = useMemo(() => {
    return transformOptions.reduce(
      (acc, option) => {
        const groupKey = option.key.startsWith('heading')
          ? 'text'
          : option.key.includes('list')
            ? 'list'
            : 'other'

        if (!acc[groupKey]) {
          acc[groupKey] = []
        }
        acc[groupKey].push(option)
        return acc
      },
      {} as Record<string, typeof transformOptions>,
    )
  }, [transformOptions])

  const groupLabels = useMemo<Record<string, string>>(
    () => ({
      text: t('blockTypeGroup.text') || 'Text',
      list: t('blockTypeGroup.list') || 'List',
      other: t('blockTypeGroup.other') || 'Other',
    }),
    [t],
  )

  const menuItems: DropdownMenuItem[] = useMemo(() => {
    if (!displayState?.node) return []

    const items: DropdownMenuItem[] = []

    const transformSubMenuItems: DropdownMenuItem[] = []

    Object.entries(groupedTransformOptions).forEach(([groupKey, options], groupIndex) => {
      if (groupIndex > 0) {
        transformSubMenuItems.push({ type: 'divider' })
      }

      transformSubMenuItems.push({
        key: `group-${groupKey}`,
        label: <span className="rme-block-handler-menu-group-label">{groupLabels[groupKey]}</span>,
        disabled: true,
      })

      options.forEach((option) => {
        transformSubMenuItems.push({
          key: option.key,
          label: option.label,
          icon: <i className={option.icon} />,
        })
      })
    })

    if (transformSubMenuItems.length > 0) {
      items.push({
        key: 'transform',
        label: t('blockType.transformTo') || 'Transform to',
        icon: <i className="ri-exchange-line" />,
        children: transformSubMenuItems as MenuItemType[],
      })
    }

    if (actionOptions.length > 0) {
      items.push({ type: 'divider' })

      actionOptions.forEach((option) => {
        items.push({
          key: option.key,
          label: option.label,
          icon: <i className={option.icon} />,
          danger: option.key === 'delete',
        })
      })
    }

    return items
  }, [displayState?.node, groupedTransformOptions, actionOptions, groupLabels])

  const handleMenuClick = useCallback(
    (item: MenuItemType) => {
      handleBlockTypeChange(item.key)
    },
    [handleBlockTypeChange],
  )

  const renderIcon = useCallback(() => {
    if (!displayState?.node) return null

    let key = displayState.node.type?.name || ''
    if (displayState.node.type?.name === 'heading') {
      key = `heading-${displayState.node.attrs?.level}`
    }

    if (displayState.node.type?.name === 'list') {
      key = `list-${displayState.node.attrs?.kind}`
    }

    const iconName = nodeTypeIconMap[key]
    if (iconName) {
      return <i className={iconName} />
    }

    return null
  }, [displayState?.node])

  if (!editorView || !displayState?.node) {
    return null
  }

  return (
    <Dropdown
      menu={{
        items: menuItems,
        onClick: handleMenuClick,
      }}
      overlayClassName="rme-block-handler-menu"
      overlayStyle={{ zIndex: editorZIndex.blockHandler + 1 }}
      trigger={['click']}
      placement="bottomLeft"
      getPopupContainer={() => document.body}
      raw
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
      triggerRef={triggerRef}
    >
      <BlockHandlerMenuStyle />
      <Container
        ref={triggerRef}
        key="rme-block-handler"
        className="rme-block-handler"
        draggable="true"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={{
          position: 'fixed',
          left: `${fixedPosition?.left ?? (state?.rect?.left ? state.rect.left - 38 : 0)}px`,
          top: `${fixedPosition?.top ?? state?.rect?.top ?? 0}px`,
        }}
      >
        <IconButton onClick={handleClick}>{renderIcon()}</IconButton>

        <div className="rme-draggable-handler">
          <i className="ri-draggable" />
        </div>
      </Container>
    </Dropdown>
  )
})

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};
  font-size: ${(props) => props.theme.fontXs};
  z-index: ${editorZIndex.blockHandler};
  background-color: ${(props) => props.theme.bgColor};
  cursor: pointer;

  &:hover {
    background-color: ${(props) => props.theme.contextMenuBgColorHover};
  }

  .rme-draggable-handler {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 18px;
    width: 18px;
    border-radius: ${(props) => props.theme.smallBorderRadius};
    cursor: grab;
  }
`

const IconButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  width: 18px;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  cursor: pointer;
`

const BlockHandlerMenuStyle = createGlobalStyle`
  .rme-block-handler-menu {
    min-width: 154px;
    max-width: 220px;
    padding: 4px;
    border-radius: 6px;
    box-shadow: 0 10px 28px ${(props) => props.theme.boxShadowColor};
  }

  .rme-block-handler-menu {
    overflow: visible;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }

  .rme-block-handler-menu > .dropdown-menu-scroll-area {
    min-height: 0;
    overflow-x: hidden;
  }

  .rme-block-handler-menu [role='separator'] {
    margin: 4px 0;
    border-color: ${(props) => props.theme.borderColor};
  }

  .rme-block-handler-menu [role='menuitem'] {
    min-height: 24px;
    padding: 3px 7px;
    gap: 6px;
    border-radius: 5px;
    line-height: 18px;
    font-size: 12px;
    font-weight: 500;
  }

  .rme-block-handler-menu [role='menuitem'][data-active-item] {
    background-color: ${(props) => props.theme.contextMenuBgColorHover};
  }

  .rme-block-handler-menu [role='menuitem']:has(.rme-block-handler-menu-group-label) {
    min-height: 18px;
    padding: 5px 7px 2px;
    background-color: transparent;
    color: ${(props) => props.theme.labelFontColor};
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0;
    opacity: 1;
    pointer-events: none;
  }

  .rme-block-handler-menu .dropdown-menu-item-icon {
    width: 14px;
    height: 14px;
    font-size: 13px;
    color: ${(props) => props.theme.labelFontColor};
  }

  .rme-block-handler-menu .dropdown-menu-item-label {
    margin-left: 2px;
  }

  .rme-block-handler-menu [aria-disabled='true'] {
    opacity: 1;
  }

  .rme-block-handler-menu [data-danger='true'] {
    color: ${(props) => props.theme.dangerColor};
  }
`
