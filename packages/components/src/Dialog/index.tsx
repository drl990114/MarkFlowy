import { DialogWrapper } from './DialogWrapper'
import type { DialogProps as AkDialogProps } from '@ariakit/react'
import { DialogDismiss } from '@ariakit/react'
import Space from '@/Space'

export interface DialogProps extends AkDialogProps {
  title?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  width?: number
}

const Dialog = (props: DialogProps) => {
  const { title, footer, children, ...rest } = props

  return (
    <DialogWrapper {...rest}>
      {title ? (
        <div className='mf-dialog__heading'>
          <div className='mf-dialog__heading__title'>{title}</div>
          <DialogDismiss className="mf-dialog__dismiss" />
        </div>
      ) : null}
      {children}
      {footer ? <Space className='mf-dialog__footer'>{footer}</Space> : null}
    </DialogWrapper>
  )
}

export default Dialog
