import styled from 'styled-components'
import { useCallback, useRef } from 'react'
import { showContextMenu } from '@/helper/context-menu'
import { useGlobalOSInfo, useGlobalSettingData } from '@/hooks'
import { emit } from '@tauri-apps/api/event'
import { EVENT } from '@/constants'
import type Dialog from '@flowy-ui/dialog'
import useThemeStore from '@/stores/useThemeStore'

export const CenterMenu = () => {
  const ref = useRef<HTMLDivElement>(null)
  const { osType } = useGlobalOSInfo()
  const { themes, setCurThemeByName } = useThemeStore()

  const settingDataHandler = useGlobalSettingData()[1]

  const getThemeMenu = useCallback(() => {
    return themes.map((theme) => {
      return {
        label: theme.name,
        value: theme.name,
        handler: () => {
          settingDataHandler.writeSettingData({ key: 'theme' }, theme.name)
          setCurThemeByName(theme.name)
        },
      }
    })
  }, [themes, setCurThemeByName, settingDataHandler])

  const handleClick = () => {
    if (!ref.current) {
      return
    }
    const rect = ref.current.getClientRects()

    const themeMenu = getThemeMenu()

    showContextMenu({
      items: [
        {
          label: 'About MarkFlowy',
          value: 'about',
          handler: () => {
            emit(EVENT.dialog_setting_about)
          },
        },
        {
          label: 'View',
          value: 'view',
          children: [
            {
              label: 'Source Code',
              value: 'sourceCode',
              handler: () => emit('editor_toggle_type', 'sourceCode'),
            },
            {
              label: 'Wysiwyg View',
              value: 'wysiwyg',
              handler: () => emit('editor_toggle_type', 'wysiwyg'),
            },
          ],
        },
        {
          label: 'Theme',
          value: 'theme',
          children: themeMenu,
        },
        {
          label: 'Settings',
          value: 'settings',
          handler: () => {
            const settingDialog = document.getElementById('setting-dialog') as Dialog
            settingDialog.open()

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
      <i className='ri-quill-pen-fill'></i>
    </Container>
  )
}

const Container = styled.div<{ isMacOs: boolean }>`
  position: absolute;
  left: ${(props) => (props.isMacOs ? '76px' : '16px')};
  top: 0;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  width: 38px;
  height: 100%;
  font-size: 16px;
  cursor: pointer;

  &:hover {
    background-color: ${(props) => props.theme.accentColor};
  }
`
