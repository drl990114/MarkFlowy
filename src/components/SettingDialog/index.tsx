import type { FC } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Button from '@mui/material/Button'
import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'
import { listen } from '@tauri-apps/api/event'
import { getName, getTauriVersion, getVersion } from '@tauri-apps/api/app'
import { writeText } from '@tauri-apps/api/clipboard'

export interface DialogTitleProps {
  children?: React.ReactNode
  onClose: () => void
}

function BootstrapDialogTitle(props: DialogTitleProps) {
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

const SettingDialog: FC = () => {
  const [open, setOpen] = useState(false)
  const [appInfo, setAppInfo] = useState({
    name: 'LineByLine',
    version: '',
    tauriVersion: '',
  })

  useEffect(() => {
    const unlisten = listen('dialog_setting', () => setOpen(true))
    Promise.all([getName(), getVersion(), getTauriVersion()]).then(([name, version, tauriVersion]) => {
      setAppInfo({
        name,
        version,
        tauriVersion,
      })
    })

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
      <DialogContent style={{ width: 500 }}>
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

export default memo(SettingDialog)
