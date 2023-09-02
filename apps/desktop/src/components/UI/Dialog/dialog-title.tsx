import { DialogTitle } from "@mui/material"
import IconButton from '@mui/material/IconButton'

export interface DialogTitleProps {
  children?: React.ReactNode
  onClose?: () => void
}

export function BootstrapDialogTitle(props: DialogTitleProps) {
  const { children, onClose, ...other } = props

  return (
    <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
      {children}
      {onClose ? (
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <i className="ri-close-fill" />
        </IconButton>
      ) : null}
    </DialogTitle>
  )
}
