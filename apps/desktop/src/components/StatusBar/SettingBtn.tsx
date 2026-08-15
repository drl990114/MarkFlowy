
import { EVENT } from '@/constants'
import { currentWindow } from '@/services/windows'
import useThemeStore from '@/stores/useThemeStore'
import { emitTo } from '@tauri-apps/api/event'
import { memo, useMemo, useRef } from 'react'
import { useTranslation } from '@/i18n'
import { showContextMenu } from '../ui-v2/ContextMenu/ContextMenu'
import { StatusBarButton } from './StatusBarButton'

export const CenterMenu = memo(() => {
  const ref = useRef<HTMLButtonElement>(null)
  const { themeMode, setThemeMode } = useThemeStore()
  const { t } = useTranslation()

  const themeMenu = useMemo(() => [
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
  ], [themeMode, setThemeMode, t])

  const handleClick = () => {
    if (!ref.current) {
      return
    }
    const rect = ref.current.getClientRects()

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
      x: rect[0]?.left || 12,
      y: rect[0]?.top - 4 || 0,
    })
  }

  return (
    <StatusBarButton
      aria-label={t('settings.label')}
      format='icon'
      ref={ref}
      onClick={handleClick}
    >
      <i aria-hidden='true' className='ri-settings-3-line' />
    </StatusBarButton>
  )
})
