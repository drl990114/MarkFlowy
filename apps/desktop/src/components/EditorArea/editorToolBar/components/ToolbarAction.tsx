import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { LucideIcon } from 'lucide-react'
import type { DesktopMenuItemData } from '@/stores/useContextMenuStore'

export type ToolbarAction = {
  id: string
  group: string
  priority: number
  label: string
  icon: LucideIcon
  pressed?: boolean
  disabled?: boolean
  run: () => void
}

type ToolbarActionButtonProps = {
  action: ToolbarAction
}

export function ToolbarActionButton({ action }: ToolbarActionButtonProps) {
  const Icon = action.icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={action.label}
          aria-pressed={action.pressed}
          data-toolbar-action={action.id}
          disabled={action.disabled}
          onClick={action.run}
          size='icon-chrome'
          variant='chrome'
        >
          <Icon aria-hidden='true' size={14} strokeWidth={1.75} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{action.label}</TooltipContent>
    </Tooltip>
  )
}

export function getOverflowToolbarActions(
  actions: ToolbarAction[],
  hiddenGroupIds: ReadonlySet<string>,
): ToolbarAction[] {
  return actions.filter((action) => hiddenGroupIds.has(action.group))
}

export function toOverflowMenuItems(actions: ToolbarAction[]): DesktopMenuItemData[] {
  return actions.map((action) => ({
    checked: action.pressed,
    disabled: action.disabled,
    handler: action.run,
    label: action.label,
    value: `toolbar-${action.id}`,
  }))
}
