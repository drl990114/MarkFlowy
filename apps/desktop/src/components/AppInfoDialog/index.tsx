import { EVENT } from '@/constants'
import useAppInfoStore from '@/stores/useAppInfoStore'
import { listen } from '@tauri-apps/api/event'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import type { FC } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, Space } from 'zens'

const AboutDialog: FC = () => {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const { appInfo } = useAppInfoStore()

  useEffect(() => {
    const unlisten = listen(EVENT.app_about, () => setOpen(true))
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
          {t('common.ok')}
        </Button>,
        <Button key='copy' btnType='primary' onClick={handleCopyAppInfo}>
          {t('common.copy')}
        </Button>,
      ]}
    >
      <div style={{ lineHeight: '24px' }}>
        <Space>{`${t('about.version')}: ${appInfo.version}`}</Space>
        <br />
        <Space>{`Tauri ${t('about.version')}: ${appInfo.tauriVersion}`}</Space>
      </div>
    </Dialog>
  )
}

export default memo(AboutDialog)
