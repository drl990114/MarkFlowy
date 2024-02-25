import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Button, Dialog } from 'zens'
import { useTranslation } from 'react-i18next'

interface ConfirmModalProps {
  title?: string
  content?: string
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
}

export const MODAL_CONFIRM_ID = 'modal-confirm'

const Confirm = NiceModal.create(
  ({ title, content, confirmText, cancelText, onConfirm }: ConfirmModalProps) => {
    const modal = useModal()
    const { t } = useTranslation()

    const handleConfirm = () => {
      if (onConfirm) {
        onConfirm()
      }
      modal.hide()
    }

    return (
      <Dialog
        title={title}
        open={modal.visible}
        onClose={modal.hide}
        footer={[
          <Button key='cancel' onClick={modal.hide}>
            {cancelText ?? t('cancel')}
          </Button>,
          <Button key='confirm' btnType='primary' onClick={handleConfirm}>
            {confirmText ?? t('confirm')}
          </Button>,
        ]}
      >
        {content}
      </Dialog>
    )
  },
)

export default {
  Confirm,
}
