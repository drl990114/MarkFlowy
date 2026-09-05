import { EVENT } from '@/constants'
import useFileCacheStore from '@/helper/files'
import { checkUnsavedFiles, saveUnsavedFiles } from '@/services/checkUnsavedFiles'
import { useEditorStateStore, useEditorStore } from '@/stores'
import { memo, type DragEvent, useCallback, useEffect, useRef } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from 'lucide-react'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { showContextMenu } from '../ui-v2/ContextMenu'
import { EditorAreaHeader } from './EditorAreaHeader'
import { EditorAreaActionButton } from './EditorAreaAction'
import {
  hasEditorTabDragData,
  readEditorTabDragData,
  writeEditorTabDragData,
} from './editorDragData'
import { Dot, TabItem } from './styles'

const Container = styled.div<{ $compact: boolean }>`
  display: flex;
  flex: 0 0 auto;
  height: 32px;
  min-width: 0;
  background-color: ${(props) => props.theme.editorTabBgColor};

  .tab-items {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;

    &::-webkit-scrollbar {
      -webkit-appearance: none;
      display: none;
    }

    &__icon {
      margin: 0 2px;
    }

    &__right {
      margin-left: ${(props) => props.theme.spaceXs};
    }
  }

  .tab-control {
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 ${(props) => props.theme.spaceXs};
    box-sizing: border-box;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    border-right: 1px solid ${(props) => props.theme.borderColor};
  }

  .tab-navigation {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .tab-filling {
    position: relative;
    flex: 1 1 ${(props) => (props.$compact ? '0' : '24px')};
    height: 100%;
    min-width: 0;
    box-sizing: border-box;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    border-left: 1px solid ${(props) => props.theme.borderColor};

    &.mf-tab-drop-before::before {
      position: absolute;
      inset: 3px auto 3px -1px;
      width: 2px;
      border-radius: 1px;
      background: var(--mf-control-focus, ${(props) => props.theme.accentColor});
      content: '';
      pointer-events: none;
    }
  }
`
interface EditorAreaTabsProps {
  compact?: boolean
  groupId: string
}

interface EditorAreaTabProps {
  active: boolean
  close: (ev: React.MouseEvent<HTMLElement, MouseEvent> | undefined, id: string) => void
  compact: boolean
  groupId: string
  handleDragEnd: (e: DragEvent<HTMLElement>) => void
  handleDragOver: (e: DragEvent<HTMLElement>) => void
  handleDrop: (e: DragEvent<HTMLElement>) => void
  id: string
  index: number
  onSelect: (id: string) => void
}

type TabDropSide = 'before' | 'after'

const TAB_DRAG_SCROLL_EDGE = 32
const TAB_DRAG_SCROLL_MAX_SPEED = 12

export function getEditorTabDropIndex(
  tabIndex: number,
  pointerX: number,
  tabLeft: number,
  tabWidth: number,
) {
  return pointerX <= tabLeft + tabWidth / 2 ? tabIndex : tabIndex + 1
}

export function getEditorTabScrollAdjustment(
  containerLeft: number,
  containerRight: number,
  tabLeft: number,
  tabRight: number,
) {
  if (tabRight - tabLeft > containerRight - containerLeft) return tabLeft - containerLeft
  if (tabRight > containerRight) return tabRight - containerRight
  if (tabLeft < containerLeft) return tabLeft - containerLeft
  return 0
}

function getTabButton(container: HTMLElement | null, id: string) {
  return Array.from(
    container?.querySelectorAll<HTMLElement>('[data-mf-editor-tab-id]') ?? [],
  ).find((tab) => tab.dataset.mfEditorTabId === id)
}

function getTabRoot(tabButton: HTMLElement) {
  return tabButton.closest<HTMLElement>('[data-mf-editor-tab-index]') ?? tabButton
}

function revealTab(container: HTMLElement | null, tabButton: HTMLElement | undefined) {
  if (!container || !tabButton) return

  const containerRect = container.getBoundingClientRect()
  const tabRect = getTabRoot(tabButton).getBoundingClientRect()
  const adjustment = getEditorTabScrollAdjustment(
    containerRect.left,
    containerRect.right,
    tabRect.left,
    tabRect.right,
  )

  if (adjustment !== 0) {
    container.scrollLeft += adjustment
  }
}

function getTabLabel(fileName: string, compact: boolean) {
  if (!compact) return fileName

  const extensionIndex = fileName.lastIndexOf('.')
  if (extensionIndex <= 0) return fileName

  return fileName.slice(0, extensionIndex)
}

export type EditorTabNavigationKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End'

export function getNextTabIndex(
  currentIndex: number,
  length: number,
  key: EditorTabNavigationKey,
): number {
  if (length <= 0 || currentIndex < 0 || currentIndex >= length) return -1
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  if (key === 'ArrowLeft') return currentIndex === 0 ? length - 1 : currentIndex - 1
  return currentIndex === length - 1 ? 0 : currentIndex + 1
}

const EditorAreaTab = memo((props: EditorAreaTabProps) => {
  const {
    active,
    close,
    compact,
    groupId,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    id,
    index,
    onSelect,
  } = props
  const hasUnsavedChanges = useEditorStateStore(
    (state) => state.idStateMap.get(id)?.hasUnsavedChanges ?? false,
  )
  const { t } = useTranslation()
  const fileName = useFileCacheStore((state) => state.entries[id]?.name)
  if (!fileName) return null

  const tabLabel = getTabLabel(fileName, compact)

  const handleMiddleClick = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    // 鼠标中键点击关闭标签页
    if (e.button !== 1) return
    e.stopPropagation()
    e.preventDefault()
    if (
      checkUnsavedFiles({
        fileIds: [id],
        onSaveAndClose: async () => {
          if (await saveUnsavedFiles([id])) {
            close(e, id)
          }
        },
        onUnsavedAndClose: () => {
          close(e, id)
        },
      }) > 0
    ) {
      return
    }
    close(e, id)
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    e.stopPropagation()
    e.preventDefault()
    showContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: t('contextmenu.editor_tab.close'),
          value: 'close',
          commandId: EVENT.app_closeCurrentEditorTab,
          handler: () => {
            if (
              checkUnsavedFiles({
                fileIds: [id],
                onSaveAndClose: async () => {
                  if (await saveUnsavedFiles([id])) {
                    close(e, id)
                  }
                },
                onUnsavedAndClose: () => {
                  close(e, id)
                },
              }) > 0
            ) {
              return
            }
            close(e, id)
          },
        },
        {
          label: t('contextmenu.editor_tab.close_others'),
          value: 'close_others',
          handler: () => {
            const { closeOtherFilesInGroup, getGroup } = useEditorStore.getState()
            const otherIds = (getGroup(groupId)?.opened || []).filter(
              (openedId) => openedId !== id,
            )
            if (
              checkUnsavedFiles({
                fileIds: otherIds,
                onSaveAndClose: async (hasUnsavedFileIds) => {
                  if (await saveUnsavedFiles(hasUnsavedFileIds)) {
                    closeOtherFilesInGroup(groupId, id)
                  }
                },
                onUnsavedAndClose: () => {
                  closeOtherFilesInGroup(groupId, id)
                },
              }) > 0
            ) {
              return
            }
            closeOtherFilesInGroup(groupId, id)
          },
        },
        {
          label: t('contextmenu.editor_tab.close_all'),
          value: 'close_all',
          handler: () => {
            const { closeAllFilesInGroup, getGroup } = useEditorStore.getState()
            const openedIds = getGroup(groupId)?.opened || []
            if (
              checkUnsavedFiles({
                fileIds: openedIds,
                onSaveAndClose: async (hasUnsavedFileIds) => {
                  if (await saveUnsavedFiles(hasUnsavedFileIds)) {
                    closeAllFilesInGroup(groupId)
                  }
                },
                onUnsavedAndClose: () => {
                  closeAllFilesInGroup(groupId)
                },
              }) > 0
            ) {
              return
            }
            closeAllFilesInGroup(groupId)
          },
        },
      ],
    })
  }

  const handleDragStart = (e: DragEvent<HTMLElement>) => {
    e.currentTarget.classList.add('mf-tab-dragging')
    writeEditorTabDragData(e.dataTransfer, {
      sourceGroupId: groupId,
      fileId: id,
    })
    e.dataTransfer.setData('text/plain', fileName)
  }

  return (
    <TabItem
      $active={active}
      data-mf-editor-tab-index={index}
      draggable
      onContextMenu={handleContextMenu}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      onDrop={handleDrop}
      onMouseDown={handleMiddleClick}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={
              hasUnsavedChanges
                ? `${fileName}, ${t('contextmenu.editor_tab.unsaved', {
                    defaultValue: 'Unsaved changes',
                  })}`
                : fileName
            }
            aria-selected={active}
            className='tab-select'
            data-mf-editor-tab-id={id}
            onClick={() => onSelect(id)}
            role='tab'
            tabIndex={active ? 0 : -1}
            type='button'
          >
            <span
              style={{
                maxWidth: compact ? '112px' : '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {tabLabel}
            </span>
            {active && hasUnsavedChanges ? (
              <span aria-live='polite' className='sr-only' role='status'>
                {t('contextmenu.editor_tab.unsaved', { defaultValue: 'Unsaved changes' })}
              </span>
            ) : null}

            {hasUnsavedChanges ? <Dot /> : null}
          </button>
        </TooltipTrigger>
        <TooltipContent>{fileName}</TooltipContent>
      </Tooltip>
      {hasUnsavedChanges ? null : (
        <EditorAreaActionButton
          className='mf-editor-tab-close'
          icon={XIcon}
          label={t('contextmenu.editor_tab.close')}
          onClick={(ev: React.MouseEvent<HTMLElement, MouseEvent> | undefined) => close(ev, id)}
        />
      )}
    </TabItem>
  )
})

const EditorAreaTabs = memo((props: EditorAreaTabsProps) => {
  const { compact = false, groupId } = props
  const group = useEditorStore((state) => state.getGroup(groupId))
  const openFileInGroup = useEditorStore((state) => state.openFileInGroup)
  const moveFileToGroup = useEditorStore((state) => state.moveFileToGroup)
  const htmlRef = useRef<HTMLDivElement>(null)
  const dropIndicatorRef = useRef<{ element: HTMLElement; side: TabDropSide } | undefined>(
    undefined,
  )
  const dragScrollFrameRef = useRef<number | undefined>(undefined)
  const dragScrollVelocityRef = useRef(0)
  const opened = group?.opened ?? []
  const openedSignature = opened.join('\u0000')
  const activeId = group?.activeId
  const showTabNavigation = !compact && opened.length > 1
  const { t } = useTranslation()

  const clearDropIndicator = useCallback(() => {
    const indicator = dropIndicatorRef.current
    if (!indicator) return

    indicator.element.classList.remove(`mf-tab-drop-${indicator.side}`)
    dropIndicatorRef.current = undefined
  }, [])

  const updateDropIndicator = useCallback(
    (element: HTMLElement, side: TabDropSide) => {
      const current = dropIndicatorRef.current
      if (current?.element === element && current.side === side) return

      clearDropIndicator()
      element.classList.add(`mf-tab-drop-${side}`)
      dropIndicatorRef.current = { element, side }
    },
    [clearDropIndicator],
  )

  const stopDragAutoScroll = useCallback(() => {
    dragScrollVelocityRef.current = 0
    if (typeof dragScrollFrameRef.current === 'number') {
      window.cancelAnimationFrame(dragScrollFrameRef.current)
      dragScrollFrameRef.current = undefined
    }
  }, [])

  const runDragAutoScroll = useCallback(() => {
    const container = htmlRef.current
    const velocity = dragScrollVelocityRef.current
    if (!container || velocity === 0) {
      dragScrollFrameRef.current = undefined
      return
    }

    const previousScrollLeft = container.scrollLeft
    container.scrollLeft += velocity
    if (container.scrollLeft === previousScrollLeft) {
      dragScrollVelocityRef.current = 0
      dragScrollFrameRef.current = undefined
      return
    }

    dragScrollFrameRef.current = window.requestAnimationFrame(runDragAutoScroll)
  }, [])

  const updateDragAutoScroll = useCallback(
    (pointerX: number) => {
      const container = htmlRef.current
      if (!container || container.scrollWidth <= container.clientWidth) {
        stopDragAutoScroll()
        return
      }

      const rect = container.getBoundingClientRect()
      if (rect.width <= 0) {
        stopDragAutoScroll()
        return
      }

      const edgeSize = Math.min(TAB_DRAG_SCROLL_EDGE, rect.width / 4)
      let velocity = 0

      if (pointerX < rect.left + edgeSize) {
        velocity = -Math.ceil(
          TAB_DRAG_SCROLL_MAX_SPEED *
            Math.min(1, (rect.left + edgeSize - pointerX) / edgeSize),
        )
      } else if (pointerX > rect.right - edgeSize) {
        velocity = Math.ceil(
          TAB_DRAG_SCROLL_MAX_SPEED *
            Math.min(1, (pointerX - (rect.right - edgeSize)) / edgeSize),
        )
      }

      dragScrollVelocityRef.current = velocity
      if (velocity === 0) {
        stopDragAutoScroll()
      } else if (typeof dragScrollFrameRef.current !== 'number') {
        dragScrollFrameRef.current = window.requestAnimationFrame(runDragAutoScroll)
      }
    },
    [runDragAutoScroll, stopDragAutoScroll],
  )

  useEffect(() => {
    const tabItems = htmlRef.current
    if (!tabItems) return

    const handleWheel = (event: WheelEvent) => {
      if (tabItems.scrollWidth <= tabItems.clientWidth) return

      const rawDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (rawDelta === 0) return

      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? tabItems.clientWidth : 1
      const previousScrollLeft = tabItems.scrollLeft
      tabItems.scrollLeft += rawDelta * scale

      if (tabItems.scrollLeft !== previousScrollLeft) {
        event.preventDefault()
      }
    }

    tabItems.addEventListener('wheel', handleWheel, { passive: false })
    return () => tabItems.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    if (!activeId) return

    const frame = window.requestAnimationFrame(() => {
      revealTab(htmlRef.current, getTabButton(htmlRef.current, activeId))
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeId, openedSignature])

  useEffect(() => stopDragAutoScroll, [stopDragAutoScroll])

  const onSelectItem = useCallback(
    (id: string) => {
      openFileInGroup(groupId, id)
    },
    [groupId, openFileInGroup],
  )

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLElement>) => {
      if (!hasEditorTabDragData(e.dataTransfer)) return

      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'

      const tabIndex = Number(e.currentTarget.dataset.mfEditorTabIndex)
      if (!Number.isInteger(tabIndex)) return

      const rect = e.currentTarget.getBoundingClientRect()
      const targetIndex = getEditorTabDropIndex(tabIndex, e.clientX, rect.left, rect.width)
      updateDropIndicator(e.currentTarget, targetIndex === tabIndex ? 'before' : 'after')
      updateDragAutoScroll(e.clientX)
    },
    [updateDragAutoScroll, updateDropIndicator],
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      const dragData = readEditorTabDragData(e.dataTransfer)
      if (!dragData) return

      e.preventDefault()
      e.stopPropagation()
      const tabIndex = Number(e.currentTarget.dataset.mfEditorTabIndex)
      const rect = e.currentTarget.getBoundingClientRect()
      const targetIndex = Number.isInteger(tabIndex)
        ? getEditorTabDropIndex(tabIndex, e.clientX, rect.left, rect.width)
        : undefined

      clearDropIndicator()
      stopDragAutoScroll()
      moveFileToGroup(dragData.sourceGroupId, groupId, dragData.fileId, targetIndex)
    },
    [clearDropIndicator, groupId, moveFileToGroup, stopDragAutoScroll],
  )

  const handleFillingDragOver = useCallback(
    (e: DragEvent<HTMLElement>) => {
      if (!hasEditorTabDragData(e.dataTransfer)) return

      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      const lastTab = e.currentTarget.previousElementSibling
      const hasLastTab =
        lastTab instanceof HTMLElement && lastTab.dataset.mfEditorTabIndex !== undefined
      updateDropIndicator(
        hasLastTab ? lastTab : e.currentTarget,
        hasLastTab ? 'after' : 'before',
      )
      updateDragAutoScroll(e.clientX)
    },
    [updateDragAutoScroll, updateDropIndicator],
  )

  const handleFillingDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      const dragData = readEditorTabDragData(e.dataTransfer)
      if (!dragData) return

      e.preventDefault()
      e.stopPropagation()
      const targetIndex = useEditorStore.getState().getGroup(groupId)?.opened.length

      clearDropIndicator()
      stopDragAutoScroll()
      moveFileToGroup(dragData.sourceGroupId, groupId, dragData.fileId, targetIndex)
    },
    [clearDropIndicator, groupId, moveFileToGroup, stopDragAutoScroll],
  )

  const handleDragEnd = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.currentTarget.classList.remove('mf-tab-dragging')
      clearDropIndicator()
      stopDragAutoScroll()
    },
    [clearDropIndicator, stopDragAutoScroll],
  )

  const handleTabBarDragLeave = useCallback(
    (e: DragEvent<HTMLElement>) => {
      const relatedTarget = e.relatedTarget
      if (relatedTarget instanceof Node && e.currentTarget.contains(relatedTarget)) return

      clearDropIndicator()
      stopDragAutoScroll()
    },
    [clearDropIndicator, stopDragAutoScroll],
  )

  const close = useCallback(
    (ev: React.MouseEvent<HTMLElement, MouseEvent> | undefined, id: string) => {
      ev?.stopPropagation()
      useEditorStore.getState().closeFileInGroup(groupId, id)
      window.requestAnimationFrame(() => {
        const nextActiveId = useEditorStore.getState().getGroup(groupId)?.activeId
        if (!nextActiveId) return

        const nextTab = getTabButton(htmlRef.current, nextActiveId)
        nextTab?.focus({ preventScroll: true })
        revealTab(htmlRef.current, nextTab)
      })
    },
    [groupId],
  )

  const handleTabListKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || target.getAttribute('role') !== 'tab') return
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return

      const tabs = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>('[data-mf-editor-tab-id]'),
      )
      const currentIndex = tabs.indexOf(target)
      if (currentIndex < 0 || tabs.length === 0) return

      const nextIndex = getNextTabIndex(
        currentIndex,
        tabs.length,
        event.key as EditorTabNavigationKey,
      )

      const nextTab = tabs[nextIndex]
      const nextId = nextTab.dataset.mfEditorTabId
      if (!nextId) return

      event.preventDefault()
      nextTab.focus({ preventScroll: true })
      revealTab(htmlRef.current, nextTab)
      openFileInGroup(groupId, nextId)
    },
    [groupId, openFileInGroup],
  )

  const moveActiveTab = (dir: 'left' | 'right') => {
    const currentGroup = useEditorStore.getState().getGroup(groupId)
    if (!currentGroup) return

    const curIndex = currentGroup.opened.findIndex(
      (openedId) => openedId === currentGroup.activeId,
    )

    if (curIndex < 0) return

    if (dir === 'left') {
      if (currentGroup.opened.length > 0) {
        openFileInGroup(
          groupId,
          curIndex === 0
            ? currentGroup.opened[currentGroup.opened.length - 1]
            : currentGroup.opened[curIndex - 1],
        )
      }
    } else {
      if (currentGroup.opened.length > 0) {
        openFileInGroup(
          groupId,
          curIndex === currentGroup.opened.length - 1
            ? currentGroup.opened[0]
            : currentGroup.opened[curIndex + 1],
        )
      }
    }
  }

  return (
    <Container
      $compact={compact}
      className='editor-area-tabs'
      onDragLeave={handleTabBarDragLeave}
      role='tablist'
    >
      {showTabNavigation ? (
        <div className='tab-control'>
          <div className='tab-navigation'>
            <EditorAreaActionButton
              icon={ArrowLeftIcon}
              label={t('contextmenu.editor_tab.previous')}
              onClick={() => moveActiveTab('left')}
            />
            <EditorAreaActionButton
              icon={ArrowRightIcon}
              label={t('contextmenu.editor_tab.next')}
              onClick={() => moveActiveTab('right')}
            />
          </div>
        </div>
      ) : null}
      <div className='tab-items' onKeyDown={handleTabListKeyDown} ref={htmlRef}>
        {opened.map((id, index) => (
          <EditorAreaTab
            active={activeId === id}
            close={close}
            compact={compact}
            groupId={groupId}
            handleDragEnd={handleDragEnd}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            id={id}
            index={index}
            key={id}
            onSelect={onSelectItem}
          />
        ))}
        <div
          className='tab-filling'
          onDragOver={handleFillingDragOver}
          onDrop={handleFillingDrop}
        />
      </div>
      <EditorAreaHeader groupId={groupId} />
    </Container>
  )
})

export default EditorAreaTabs
