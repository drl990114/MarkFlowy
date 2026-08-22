import { Button } from '@/components/ui/button'
import { APP_NAME, EVENT } from '@/constants'
import { useTranslation } from '@/i18n'
import { currentWindow } from '@/services/windows'
import useThemeStore from '@/stores/useThemeStore'
import { emitTo } from '@tauri-apps/api/event'
import { ChevronDownIcon, SettingsIcon } from 'lucide-react'
import { memo, useMemo, useRef } from 'react'
import { StatusBarButton } from '../StatusBar/StatusBarButton'
import { showContextMenu } from '../ui-v2/ContextMenu/ContextMenu'

interface AppMenuButtonProps {
  location?: 'statusbar' | 'titlebar'
}

export const AppMenuButton = memo(({ location = 'titlebar' }: AppMenuButtonProps) => {
  const ref = useRef<HTMLButtonElement>(null)
  const { themeMode, setThemeMode } = useThemeStore()
  const { t } = useTranslation()
  const isStatusBarFallback = location === 'statusbar'

  const themeMenu = useMemo(
    () => [
      {
        label: t('settings.display.theme.mode.system'),
        value: 'system',
        checked: themeMode === 'system',
        handler: () => {
          setThemeMode('system')
        },
      },
      {
        label: t('settings.display.theme.mode.light'),
        value: 'light',
        checked: themeMode === 'light',
        handler: () => {
          setThemeMode('light')
        },
      },
      {
        label: t('settings.display.theme.mode.dark'),
        value: 'dark',
        checked: themeMode === 'dark',
        handler: () => {
          setThemeMode('dark')
        },
      },
    ],
    [setThemeMode, t, themeMode],
  )

  const handleClick = () => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return

    showContextMenu({
      items: [
        {
          label: t('about.label'),
          value: 'about',
          handler: () => {
            emitTo(currentWindow.label, EVENT.app_about)
          },
        },
        {
          label: t('view.theme.label'),
          value: 'theme',
          children: themeMenu,
        },
        {
          label: t('settings.label'),
          value: 'settings',
          commandId: EVENT.app_openSetting,
        },
      ],
      x: isStatusBarFallback ? rect.left : rect.right,
      y: isStatusBarFallback ? rect.top - 4 : rect.bottom + 4,
    })
  }

  if (isStatusBarFallback) {
    return (
      <StatusBarButton
        aria-haspopup='menu'
        aria-label={t('settings.label')}
        format='icon'
        ref={ref}
        onClick={handleClick}
      >
        <SettingsIcon aria-hidden='true' />
      </StatusBarButton>
    )
  }

  return (
    <Button
      aria-haspopup='menu'
      aria-label={`${APP_NAME} ${t('common.menu')}`}
      className='mx-1 text-content-secondary'
      ref={ref}
      size='icon-chrome'
      variant='chrome'
      onClick={handleClick}
    >
      <ChevronDownIcon aria-hidden='true' className='size-3.5 text-content-primary' />
    </Button>
  )
})
