import { commandRegistry } from '@/commands'
import { useTranslation } from '@/i18n'
import useLayoutStore from '@/stores/useLayoutStore'
import { EditorAreaActionButton } from './EditorAreaAction'

interface SidebarToggleButtonProps {
  side: 'left' | 'right'
}

const sidebarToggleConfig = {
  left: {
    commandId: 'app_toggleLeftsidebarVisible',
    activeIcon: 'ri-layout-left-fill',
    inactiveIcon: 'ri-layout-left-line',
  },
  right: {
    commandId: 'app_toggleRightsidebarVisible',
    activeIcon: 'ri-layout-right-fill',
    inactiveIcon: 'ri-layout-right-line',
  },
} as const

export function SidebarToggleButton({ side }: SidebarToggleButtonProps) {
  const visible = useLayoutStore((state) =>
    side === 'left' ? state.leftBar.visible : state.rightBar.visible,
  )
  const { t } = useTranslation()
  const config = sidebarToggleConfig[side]
  const label = t(`command.id_descriptions.${config.commandId}`)
  const icon = visible ? config.activeIcon : config.inactiveIcon

  return (
    <EditorAreaActionButton
      aria-pressed={visible}
      data-sidebar-toggle={side}
      icon={icon}
      label={label}
      onClick={() => commandRegistry.execute(config.commandId)}
    />
  )
}
