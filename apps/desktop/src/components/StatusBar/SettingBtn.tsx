
import { EVENT } from '@/constants'
import { currentWindow } from '@/services/windows'
import useThemeStore from '@/stores/useThemeStore'
import { emitTo } from '@tauri-apps/api/event'
import { memo, useMemo, useRef } from 'react'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'
import { showContextMenu } from '../ui-v2/ContextMenu/ContextMenu'

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
    <Container
      aria-label={t('settings.label')}
      className='icon-small icon-smooth'
      ref={ref}
      onClick={handleClick}
      type='button'
    >
      <i aria-hidden='true' className='ri-settings-3-line' />
    </Container>
  )
})

const Container = styled.button`
  padding: 0;
  border: 0;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  color: ${(props) => props.theme.labelFontColor};
  background: transparent;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  transition:
    color 100ms ease,
    background-color 100ms ease;

  &:hover {
    color: ${(props) => props.theme.primaryFontColor};
    background-color: ${(props) => props.theme.hoverColor};
  }

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: -2px;
  }
`
