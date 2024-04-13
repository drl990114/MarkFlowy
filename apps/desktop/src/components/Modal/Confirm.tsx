import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Button, Dialog } from 'zens'
import { useTranslation } from 'react-i18next'

export interface ConfirmModalProps {
  title?: string
  content?: React.ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onClose?: () => void
}

export const MODAL_CONFIRM_ID = 'modal-confirm'

export const ConfirmModal = ({
  title,
  content,
  confirmText,
  cancelText,
  onConfirm,
  onClose
}: ConfirmModalProps) => {
  const modal = useModal()
  const { t } = useTranslation()

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }
    modal.hide()
  }

  const handleClose = () => {
    onClose?.()
    modal.hide()
  }

  return (
    <Dialog
      title={title}
      open={modal.visible}
      onClose={handleClose}
      footer={[
        <Button key='cancel' onClick={handleClose}>
          {cancelText ?? t('common.cancel')}
        </Button>,
        <Button key='confirm' btnType='primary' onClick={handleConfirm}>
          {confirmText ?? t('common.confirm')}
        </Button>,
      ]}
    >
      {content}
    </Dialog>
  )
}

export const Confirm = NiceModal.create(ConfirmModal)
