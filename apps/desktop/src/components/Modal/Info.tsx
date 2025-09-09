import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Dialog } from 'zens'

export interface InfoModalProps {
  title?: string
  content?: React.ReactNode
  onClose?: () => void
  width?: string
}

export const MODAL_INFO_ID = 'modal-info'

export const InfoModal = (props: InfoModalProps) => {
  const { title, content, onClose } = props
  const modal = useModal()

  const handleClose = () => {
    onClose?.()
    modal.hide()
  }

  return (
    <Dialog
      title={title}
      open={modal.visible}
      onClose={handleClose}
      footer={null}
      width={props.width}
    >
      {content}
    </Dialog>
  )
}

export const Info = NiceModal.create(InfoModal)
