import { Button } from '@/components/ui/button'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItemPrimitive,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ContextMenu } from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/i18n'
import useLayoutStore, { getDockPanelSide, type DockPanelId } from '@/stores/useLayoutStore'
import { EllipsisIcon } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { moveDockPanelToOtherSide, resetDockLayout } from './dockActions'
import './dockInteractions.css'

function usePanelActions(panelId: DockPanelId) {
  const { t } = useTranslation()
  const side = useLayoutStore((state) => getDockPanelSide(state.panelOrder, panelId))
  const relocated = useRef(false)
  return {
    t,
    label: t(side === 'left' ? 'sidebar.move_right' : 'sidebar.move_left'),
    move() {
      relocated.current = true
      moveDockPanelToOtherSide(panelId)
    },
    reset() {
      relocated.current = true
      resetDockLayout(panelId)
    },
    onCloseAutoFocus(event: Event) {
      if (relocated.current) event.preventDefault()
      relocated.current = false
    },
  }
}

export function DockPanelMenu({
  panelId,
  children,
}: {
  panelId: DockPanelId
  children?: ReactNode
}) {
  const actions = usePanelActions(panelId)
  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <Button
          className='mf-dock-panel-menu'
          aria-label={actions.t('sidebar.panel_actions')}
          size='icon-chrome'
          variant='chrome'
        >
          <EllipsisIcon aria-hidden='true' strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' onCloseAutoFocus={actions.onCloseAutoFocus}>
        {children}
        {children ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItemPrimitive onSelect={actions.move}>
          {actions.label}
        </DropdownMenuItemPrimitive>
        <DropdownMenuSeparator />
        <DropdownMenuItemPrimitive onSelect={actions.reset}>
          {actions.t('sidebar.reset_layout')}
        </DropdownMenuItemPrimitive>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  )
}

export function DockPanelContextMenu({
  panelId,
  children,
  tooltip,
}: {
  panelId: DockPanelId
  children: ReactNode
  tooltip?: ReactNode
}) {
  const actions = usePanelActions(panelId)
  const trigger = <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
  return (
    <ContextMenu>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side='top'>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <ContextMenu.Content onCloseAutoFocus={actions.onCloseAutoFocus}>
        <ContextMenu.Item onSelect={actions.move}>{actions.label}</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item onSelect={actions.reset}>
          {actions.t('sidebar.reset_layout')}
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  )
}
