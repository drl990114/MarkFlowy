import { Dialog, Button, Space } from '@markflowy/components'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { listen } from '@tauri-apps/api/event'
import type { FC } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import { EVENT } from '@/constants'
import { useTranslation } from 'react-i18next'
import useAppInfoStore from '@/stores/useAppInfoStore'

const AboutDialog: FC = () => {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const { appInfo } = useAppInfoStore()

  useEffect(() => {
    const unlisten = listen(EVENT.dialog_setting_about, () => setOpen(true))
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  const getAppInfoDesc = useCallback(() => {
    return `
AppName: ${appInfo.name}
Version: ${appInfo.version}
TauriVersion: ${appInfo.tauriVersion}
`
  }, [appInfo])

  const handleCopyAppInfo = useCallback(() => {
    writeText(getAppInfoDesc())
    setOpen(false)
  }, [getAppInfoDesc])

  const handleClose = useCallback(() => setOpen(false), [])

  return (
    <Dialog
      open={open}
      title={appInfo.name}
      onClose={handleClose}
      footer={[
        <Button key='ok' onClick={handleClose}>
          {t('ok')}
        </Button>,
        <Button key='copy' btnType='primary' onClick={handleCopyAppInfo}>
          {t('copy')}
        </Button>,
      ]}
    >
      <Space>{`${t('about.version')}: ${appInfo.version}`}</Space>
      <br />
      <Space>{`Tauri ${t('about.version')}: ${appInfo.tauriVersion}`}</Space>
    </Dialog>
  )
}

export default memo(AboutDialog)
