import { commandRegistry } from '@/commands'
import { useTranslation } from '@/i18n'
import useLayoutStore from '@/stores/useLayoutStore'
import { PanelLeftIcon, PanelRightIcon } from 'lucide-react'
import { EditorAreaActionButton } from './EditorAreaAction'

interface SidebarToggleButtonProps {
  side: 'left' | 'right'
}

const sidebarToggleConfig = {
  left: {
    commandId: 'app_toggleLeftsidebarVisible',
    icon: PanelLeftIcon,
  },
  right: {
    commandId: 'app_toggleRightsidebarVisible',
    icon: PanelRightIcon,
  },
} as const

export function SidebarToggleButton({ side }: SidebarToggleButtonProps) {
  const visible = useLayoutStore((state) =>
    side === 'left' ? state.leftBar.visible : state.rightBar.visible,
  )
  const { t } = useTranslation()
  const config = sidebarToggleConfig[side]
  const label = t(`command.id_descriptions.${config.commandId}`)

  return (
    <EditorAreaActionButton
      aria-pressed={visible}
      data-sidebar-toggle={side}
      icon={config.icon}
      label={label}
      onClick={() => commandRegistry.execute(config.commandId)}
    />
  )
}
