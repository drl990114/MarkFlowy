import Button from '@mui/material/Button'
import DialogContentText from '@mui/material/DialogContentText'
import { getName, getTauriVersion, getVersion } from '@tauri-apps/api/app'
import { writeText } from '@tauri-apps/api/clipboard'
import { listen } from '@tauri-apps/api/event'
import type { FC } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import { EVENT } from '@/constants'
import { MfDialog } from '../UI/Dialog'

const AboutDialog: FC = () => {
  const [open, setOpen] = useState(false)
  const [appInfo, setAppInfo] = useState({
    name: 'LineByLine',
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
        <Button key='ok' onClick={handleClose}>Ok</Button>,
        <Button key='copy' onClick={handleCopyAppInfo}>Copy</Button>,
      ]}
    >
      <DialogContentText>{`Version: ${appInfo.version}`}</DialogContentText>
      <DialogContentText>{`Tauri Version: ${appInfo.tauriVersion}`}</DialogContentText>
    </MfDialog>
  )
}

export default memo(AboutDialog)
