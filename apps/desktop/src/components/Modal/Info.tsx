import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Dialog } from 'zens'

export interface InfoModalProps {
  title?: string
  content?: React.ReactNode
  onClose?: () => void
}

export const MODAL_INFO_ID = 'modal-info'

export const InfoModal = ({
  title,
  content,
  onClose,
}: InfoModalProps) => {
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
    >
      {content}
    </Dialog>
  )
}

export const Info = NiceModal.create(InfoModal)
