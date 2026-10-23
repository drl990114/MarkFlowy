import { scheduleActiveEditorFocus } from '@/components/EditorArea/focusActiveEditor'
import { useTranslation } from '@/i18n'
import useLayoutStore, { type DockPanelId, type DockSide } from '@/stores/useLayoutStore'
import { StatusBarButton } from '@/components/StatusBar/StatusBarButton'
import { getDockPanels } from './dockPanels'
import useEditorStore from '@/stores/useEditorStore'
import { useEffect, useRef, useState } from 'react'
import { DockPanelContextMenu } from './DockPanelMenu'
import {
  clearDockDrag,
  hasDockPanelDragData,
  readDockPanelDragData,
  useDockDragStore,
  writeDockPanelDragData,
} from './dockDragData'
import { moveDockPanel } from './dockActions'
import { useDockDropTarget } from './useDockDropTarget'

export function scheduleDockFocus(side: DockSide): void {
  window.requestAnimationFrame(() => {
    const dock = document.querySelector<HTMLElement>(
      `[data-mf-dock-side="${side}"][data-mf-dock-visible="true"]`,
    )
    if (!dock) return

    const focusTarget = dock.querySelector<HTMLElement>(
      '[data-mf-dock-initial-focus], input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    ;(focusTarget ?? dock).focus({ preventScroll: true })
  })
}

export function DockSwitcher({ side }: { side: DockSide }) {
  const { t } = useTranslation()
  const dock = useLayoutStore((state) => (side === 'left' ? state.leftBar : state.rightBar))
  const toggleDockPanel = useLayoutStore((state) => state.toggleDockPanel)
  const hasWorkspace = useEditorStore((state) => Boolean(state.folderData?.[0]?.path))
  const panelOrder = useLayoutStore((state) => state.panelOrder)
  const draggedPanelId = useDockDragStore((state) => state.panelId)
  const dragging = draggedPanelId !== null
  const [insertion, setInsertion] = useState<{
    panelId: DockPanelId
    index: number
    edge: 'before' | 'after'
  } | null>(null)
  const suppressClickUntil = useRef(0)
  const panels = getDockPanels(side, panelOrder, hasWorkspace)
  const dropTarget = useDockDropTarget(side)
  useEffect(() => {
    if (!dragging) setInsertion(null)
  }, [dragging])

  const handleSelect = (panelId: DockPanelId) => {
    const isClosing = dock.visible && dock.activePanelId === panelId
    toggleDockPanel(side, panelId)

    if (isClosing) {
      scheduleActiveEditorFocus()
    } else {
      scheduleDockFocus(side)
    }
  }

  return (
    <div
      aria-label={t(side === 'left' ? 'sidebar.leftDock' : 'sidebar.rightDock')}
      className={`mf-dock-switcher${dragging && dropTarget.over ? ' mf-dock-drop-active' : ''}`}
      role='group'
      {...dropTarget.handlers}
      onDragOver={(event) => {
        if (hasDockPanelDragData(event.dataTransfer)) setInsertion(null)
        dropTarget.handlers.onDragOver(event)
      }}
      onDragLeave={(event) => {
        dropTarget.handlers.onDragLeave(event)
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          setInsertion(null)
      }}
    >
      {panels.map((panel) => {
        const label = t(panel.labelKey, { defaultValue: panel.fallbackLabel })
        const pressed = dock.visible && dock.activePanelId === panel.id
        const tooltipLabel = pressed
          ? `${t('common.close')} · ${t(side === 'left' ? 'sidebar.leftDock' : 'sidebar.rightDock')}`
          : label
        const Icon = panel.icon
        const index = panelOrder[side].indexOf(panel.id)

        return (
          <span
            className='mf-dock-switcher__item'
            key={panel.id}
            data-drop-edge={
              dragging && insertion?.panelId === panel.id ? insertion.edge : undefined
            }
            onDragOver={(event) => {
              if (!hasDockPanelDragData(event.dataTransfer)) return
              event.preventDefault()
              event.stopPropagation()
              event.dataTransfer.dropEffect = 'move'
              const rect = event.currentTarget.getBoundingClientRect()
              const after = event.clientX >= rect.left + rect.width / 2
              setInsertion({
                panelId: panel.id,
                index: index + (after ? 1 : 0),
                edge: after ? 'after' : 'before',
              })
            }}
            onDrop={(event) => {
              if (!hasDockPanelDragData(event.dataTransfer)) return
              event.preventDefault()
              event.stopPropagation()
              const panelId = readDockPanelDragData(event.dataTransfer)
              if (panelId)
                moveDockPanel(
                  panelId,
                  side,
                  insertion?.panelId === panel.id ? insertion.index : index,
                )
              setInsertion(null)
              clearDockDrag()
            }}
          >
            <DockPanelContextMenu
              panelId={panel.id}
              tooltip={
                <>
                  {tooltipLabel}
                  <span className='block text-ui-caption text-content-muted'>
                    {t('sidebar.drag_hint')}
                  </span>
                </>
              }
            >
              <StatusBarButton
                aria-label={label}
                aria-pressed={pressed}
                className='mf-dock-switcher__button'
                data-mf-dock-panel-id={panel.id}
                data-drag-source={draggedPanelId === panel.id ? '' : undefined}
                format='icon'
                draggable
                onDragStart={(event) => {
                  suppressClickUntil.current = Date.now() + 150
                  writeDockPanelDragData(event.dataTransfer, panel.id)
                }}
                onDragEnd={() => {
                  suppressClickUntil.current = Date.now() + 150
                  clearDockDrag()
                  setInsertion(null)
                }}
                onClick={() => {
                  if (!dragging && Date.now() >= suppressClickUntil.current) handleSelect(panel.id)
                }}
              >
                <Icon
                  aria-hidden='true'
                  className={pressed ? 'text-primary' : undefined}
                  size={14}
                  strokeWidth={1.75}
                />
              </StatusBarButton>
            </DockPanelContextMenu>
          </span>
        )
      })}
    </div>
  )
}
