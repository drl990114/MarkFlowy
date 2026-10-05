import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { scheduleActiveEditorFocus } from '@/components/EditorArea/focusActiveEditor'
import { useTranslation } from '@/i18n'
import useLayoutStore, { type DockPanelId, type DockSide } from '@/stores/useLayoutStore'
import { StatusBarButton } from '@/components/StatusBar/StatusBarButton'
import { getDockPanels } from './dockPanels'
import useEditorStore from '@/stores/useEditorStore'

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
  const panels = getDockPanels(side).filter((panel) => hasWorkspace || !['explorer', 'search'].includes(panel.id))

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
      className='mf-dock-switcher'
      role='group'
    >
      {panels.map((panel) => {
        const label = t(panel.labelKey, { defaultValue: panel.fallbackLabel })
        const pressed = dock.visible && dock.activePanelId === panel.id
        const tooltipLabel = pressed
          ? `${t('common.close')} · ${t(side === 'left' ? 'sidebar.leftDock' : 'sidebar.rightDock')}`
          : label
        const Icon = panel.icon

        return (
          <Tooltip key={panel.id}>
            <TooltipTrigger asChild>
              <StatusBarButton
                aria-label={label}
                aria-pressed={pressed}
                className='mf-dock-switcher__button'
                data-mf-dock-panel-id={panel.id}
                format='icon'
                onClick={() => handleSelect(panel.id)}
              >
                <Icon
                  aria-hidden='true'
                  className={pressed ? 'text-primary' : undefined}
                  size={14}
                  strokeWidth={1.75}
                />
              </StatusBarButton>
            </TooltipTrigger>
            <TooltipContent side='top'>{tooltipLabel}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
