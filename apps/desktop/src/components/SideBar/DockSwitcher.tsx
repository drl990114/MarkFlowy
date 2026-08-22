import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { scheduleActiveEditorFocus } from '@/components/EditorArea/focusActiveEditor'
import { useTranslation } from '@/i18n'
import useLayoutStore, { type DockPanelId, type DockSide } from '@/stores/useLayoutStore'
import { StatusBarButton } from '@/components/StatusBar/StatusBarButton'
import { getDockPanels } from './dockPanels'

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
  const overlayDock = useLayoutStore((state) => state.overlayDock)
  const viewportMode = useLayoutStore((state) => state.viewportMode)
  const toggleDockPanel = useLayoutStore((state) => state.toggleDockPanel)
  const panels = getDockPanels(side)
  const usesOverlay = viewportMode === 'compact' || (viewportMode === 'medium' && side === 'right')
  const dockVisible = usesOverlay ? overlayDock === side : dock.visible

  const handleSelect = (panelId: DockPanelId) => {
    const isClosing = dockVisible && dock.activePanelId === panelId
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
        const pressed = dockVisible && dock.activePanelId === panel.id
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
                data-mf-dock-trigger={side}
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
