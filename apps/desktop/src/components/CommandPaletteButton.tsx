import { commandRegistry } from '@/commands'
import { useCommandShortcut } from '@/commands/useCommandShortcut'
import { EVENT } from '@/constants'
import { useTranslation } from '@/i18n'
import { SquareTerminalIcon } from 'lucide-react'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { StatusBarButton } from './StatusBar/StatusBarButton'

export function CommandPaletteButton({
  location = 'titlebar',
}: {
  location?: 'titlebar' | 'statusbar'
}) {
  const { t } = useTranslation()
  const shortcut = useCommandShortcut(EVENT.app_commandPalette)
  const label = t('command_palette.title')
  const tooltip = shortcut ? `${label} (${shortcut})` : label
  const props = {
    'aria-label': tooltip,
    'aria-haspopup': 'dialog' as const,
    'data-slot': 'command-palette-trigger',
    onClick: () => {
      void commandRegistry.execute(EVENT.app_commandPalette)
    },
    children: <SquareTerminalIcon aria-hidden='true' className='size-3.5' strokeWidth={1.75} />,
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {location === 'statusbar' ? (
          <StatusBarButton format='icon' {...props} />
        ) : (
          <Button variant='chrome' size='icon-chrome' {...props} />
        )}
      </TooltipTrigger>
      <TooltipContent side={location === 'statusbar' ? 'top' : 'bottom'}>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
