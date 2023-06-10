import { EVENT } from '@/constants'
import CloseIcon from '@mui/icons-material/Close'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import { getName, getTauriVersion, getVersion } from '@tauri-apps/api/app'
import { writeText } from '@tauri-apps/api/clipboard'
import { listen } from '@tauri-apps/api/event'
import type { FC } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'

export interface DialogTitleProps {
  children?: React.ReactNode
  onClose: () => void
}

export function BootstrapDialogTitle(props: DialogTitleProps) {
  const { children, onClose, ...other } = props

  return (
    <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
      {children}
      {onClose
        ? (
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
          )
        : null}
    </DialogTitle>
  )
}

const AboutDialog: FC = () => {
  const [open, setOpen] = useState(false)
  const [appInfo, setAppInfo] = useState({
    name: 'LineByLine',
    version: '',
    tauriVersion: '',
  })

  useEffect(() => {
    Promise.all([getName(), getVersion(), getTauriVersion()]).then(([name, version, tauriVersion]) => {
      setAppInfo({
        name,
        version,
        tauriVersion,
      })
    })

    const unlisten = listen(EVENT.dialog_setting_about, () => setOpen(true))
    return () => {
      unlisten.then(fn => fn())
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
    <Dialog open={open}>
      <BootstrapDialogTitle onClose={handleClose}>{appInfo.name}</BootstrapDialogTitle>
      <DialogContent style={{ width: 450 }}>
        <DialogContentText>{`Version: ${appInfo.version}`}</DialogContentText>
        <DialogContentText>{`Tauri Version: ${appInfo.tauriVersion}`}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Ok</Button>
        <Button onClick={handleCopyAppInfo} autoFocus>
          Copy
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default memo(AboutDialog)
