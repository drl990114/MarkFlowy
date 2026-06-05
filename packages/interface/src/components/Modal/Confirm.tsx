import React, { useMemo, useState } from 'react'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useTranslation } from '@markflowy/i18n'
import { Button, Dialog } from 'zens'

export interface DialogAction {
  id: string
  label: React.ReactNode
  primary?: boolean
  danger?: boolean
  disabled?: boolean
  autoFocus?: boolean
}

export interface DialogRememberOptions {
  key: string
  label?: React.ReactNode
  enabled?: boolean
}

export interface ConfirmModalProps {
  title?: string
  content?: React.ReactNode
  actions?: DialogAction[]
  remember?: DialogRememberOptions
  onResolve?: (actionId: string | null) => void
  onRemember?: (actionId: string) => void | Promise<void>
}

export const MODAL_CONFIRM_ID = 'modal-confirm'

export const ConfirmModal = ({
  title,
  content,
  actions,
  remember,
  onResolve,
  onRemember,
}: ConfirmModalProps) => {
  const modal = useModal()
  const { t } = useTranslation()
  const [rememberChecked, setRememberChecked] = useState(false)

  const normalizedActions = useMemo<DialogAction[]>(
    () =>
      actions?.length
        ? actions
        : [
            { id: 'cancel', label: t('common.cancel') },
            { id: 'confirm', label: t('common.confirm'), primary: true },
          ],
    [actions, t],
  )

  const handleAction = async (action: DialogAction) => {
    if (remember?.enabled !== false && rememberChecked) {
      await onRemember?.(action.id)
    }
    onResolve?.(action.id)
    setRememberChecked(false)
    modal.hide()
  }

  const handleClose = () => {
    onResolve?.(null)
    setRememberChecked(false)
    modal.hide()
  }

  return (
    <Dialog
      title={title}
      open={modal.visible}
      onClose={handleClose}
      style={{
        zIndex: 99,
      }}
      footer={
        <div className='mf-confirm__footer'>
          {remember?.enabled === false ? null : remember ? (
            <label className='mf-confirm__remember'>
              <input
                type='checkbox'
                checked={rememberChecked}
                onChange={(event) => setRememberChecked(event.target.checked)}
              />
              <span>{remember.label ?? 'Remember this choice'}</span>
            </label>
          ) : (
            <span />
          )}
          <div className='mf-confirm__actions'>
            {normalizedActions.map((action) => (
              <Button
                key={action.id}
                btnType={action.primary ? 'primary' : 'default'}
                danger={action.danger}
                disabled={action.disabled}
                autoFocus={action.autoFocus}
                onClick={() => handleAction(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      }
    >
      {content ? <div className='mf-confirm__content'>{content}</div> : null}
    </Dialog>
  )
}

export const Confirm = NiceModal.create(ConfirmModal)
