import { Dialog } from 'zens'
import { Setting } from '@/router'
import { memo, useCallback, useEffect, useState } from 'react'
import { useCommandStore } from '@/stores'
import styled from 'styled-components'
import { useTranslation } from 'react-i18next'

const SettingDialogWrapper = styled(Dialog)`
  height: 80vh;
  max-width: 1000px;
  min-width: 700px;
  max-height: 700px;
  overflow: hidden;
  background-color: ${(props) => props.theme.bgColor};
  transition: all 0.3s ease-in-out;

  .dialog-content {
    height: calc(100% - 60px);
    overflow-y: auto;
    padding: 0 24px;
    
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-thumb {
      background-color: ${(props) => props.theme.borderColor};
      border-radius: 3px;
    }
  }
`

export const SettingDialog = memo(() => {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    useCommandStore.getState().addCommand({
      id: 'open_setting_dialog',
      handler: () => {
        setOpen(true)
      },
    })
  }, [])

  const handleClose = useCallback(() => setOpen(false), [])

  return (
    <SettingDialogWrapper
      width='70vw'
      title={t('settings.label')}
      open={open}
      onClose={handleClose}
    >
      <Setting />
    </SettingDialogWrapper>
  )
})
