import styled from 'styled-components'
import { memo, useCallback, useRef } from 'react'
import { useGlobalOSInfo } from '@/hooks'
import { emit } from '@tauri-apps/api/event'
import { APP_NAME, EVENT } from '@/constants'
import useThemeStore from '@/stores/useThemeStore'
import { showContextMenu } from '../UI/ContextMenu/ContextMenu'
import { useCommandStore } from '@/stores'
import appSettingService from '@/services/app-setting'
import { useTranslation } from 'react-i18next'

export const CenterMenu = memo(() => {
  const ref = useRef<HTMLDivElement>(null)
  const { osType } = useGlobalOSInfo()
  const { themes, curTheme, setCurThemeByName } = useThemeStore()
  const { t } = useTranslation()

  const getThemeMenu = useCallback(() => {
    return themes.map((theme) => {
      return {
        label: theme.name,
        value: theme.name,
        checked: curTheme.name === theme.name,
        handler: () => {
          appSettingService.writeSettingData({ key: 'theme' }, theme.name)
          setCurThemeByName(theme.name)
        },
      }
    })
  }, [themes, curTheme, setCurThemeByName])

  const handleClick = () => {
    if (!ref.current) {
      return
    }
    const rect = ref.current.getClientRects()

    const themeMenu = getThemeMenu()

    showContextMenu({
      items: [
        {
          label: t('about.label'),
          value: 'about',
          handler: () => {
            emit(EVENT.dialog_setting_about)
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
          handler: () => {
            useCommandStore.getState().execute('open_setting_dialog')
            // FIXME tauri 2.0 bug in windows https://github.com/tauri-apps/plugins-workspace/issues/656
            // invoke('open_conf_window')
          },
        },
      ],
      x: rect[0]?.left || 12,
      y: rect[0]?.bottom + 8 || 0,
    })
  }

  return (
    <Container ref={ref} isMacOs={osType === 'macos'} onClick={handleClick}>
      <small>{APP_NAME}</small>
    </Container>
  )
})

const Container = styled.div<{ isMacOs: boolean }>`
  position: absolute;
  left: ${(props) => (props.isMacOs ? '76px' : '16px')};
  top: 0;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  width: 74px;
  height: 100%;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s ease-in-out;

  &:hover {
    background-color: ${(props) => props.theme.accentColor};
  }
`
