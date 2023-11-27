import Button from '@mui/material/Button'
import DialogContentText from '@mui/material/DialogContentText'
import { getName, getTauriVersion, getVersion } from '@tauri-apps/api/app'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { listen } from '@tauri-apps/api/event'
import type { FC } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import { EVENT } from '@/constants'
import { MfDialog } from '../UI/Dialog'
import { useTranslation } from 'react-i18next'

const AboutDialog: FC = () => {
  const [open, setOpen] = useState(false)
  const { t }= useTranslation()
  const [appInfo, setAppInfo] = useState({
    name: '',
    version: '',
    tauriVersion: '',
  })

  useEffect(() => {
    Promise.all([getName(), getVersion(), getTauriVersion()]).then(
      ([name, version, tauriVersion]) => {
        setAppInfo({
          name,
          version,
          tauriVersion,
        })
      },
    )

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
    <MfDialog
      open={open}
      title={appInfo.name}
      onClose={handleClose}
      actions={[
        <Button key='ok' onClick={handleClose}>{t('ok')}</Button>,
        <Button key='copy' onClick={handleCopyAppInfo}>{t('copy')}</Button>,
      ]}
    >
      <DialogContentText>{`${t('about.version')}: ${appInfo.version}`}</DialogContentText>
      <DialogContentText>{`Tauri ${t('about.version')}: ${appInfo.tauriVersion}`}</DialogContentText>
    </MfDialog>
  )
}

export default memo(AboutDialog)
