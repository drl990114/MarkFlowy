import type { DialogActionsProps, DialogContentProps } from '@mui/material'
import { Dialog, DialogActions, DialogContent } from '@mui/material'
import { BootstrapDialogTitle } from './dialog-title'

export interface MfDialogProps {
  open: boolean
  title?: string
  children?: React.ReactNode
  actions?: React.ReactNode[]
  dialogContentProps?: DialogContentProps
  dialogActionsProps?: DialogActionsProps
  onClose?: () => void
}

export function MfDialog(props: MfDialogProps) {
  const {
    children,
    onClose,
    actions,
    open,
    title,
    dialogActionsProps = {},
    dialogContentProps = [],
  } = props

  const handleClose = () => {
    if (onClose) {
      onClose()
    }
  }

  return (
    <Dialog open={open}>
      <BootstrapDialogTitle onClose={handleClose}>{title}</BootstrapDialogTitle>
      <DialogContent style={{ width: 450 }} {...dialogContentProps}>
        {children}
      </DialogContent>
      {actions ? <DialogActions {...dialogActionsProps}>{actions}</DialogActions> : null}
    </Dialog>
  )
}
