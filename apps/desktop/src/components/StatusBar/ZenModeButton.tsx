import { commandRegistry, keybindingRegistry } from '@/commands'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EVENT } from '@/constants'
import { useGlobalKeyboard } from '@/hooks'
import { useTranslation } from '@/i18n'
import { useEditorStore } from '@/stores'
import { useState } from 'react'
import { ZenModeIcon } from './ZenModeIcon'
import { StatusBarButton } from './StatusBarButton'

export function ZenModeButton() {
  const activeId = useEditorStore((state) => state.activeId)
  const { keyboardInfos } = useGlobalKeyboard()
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)

  if (!activeId) return null

  const label = t('command.id_descriptions.app_toggleZenMode')
  const zenModeKeybinding = keyboardInfos.find((binding) => binding.id === EVENT.app_toggleZenMode)
  const shortcut = zenModeKeybinding
    ? keybindingRegistry.formatKeyMap(zenModeKeybinding.key_map)
    : undefined
  const accessibleLabel = shortcut ? `${label} (${shortcut})` : label

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <StatusBarButton
          aria-label={accessibleLabel}
          data-zen-mode-toggle=''
          format='icon'
          onClick={() => commandRegistry.execute(EVENT.app_toggleZenMode)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <ZenModeIcon rotating={hovered} />
        </StatusBarButton>
      </TooltipTrigger>
      <TooltipContent side='top'>{accessibleLabel}</TooltipContent>
    </Tooltip>
  )
}
