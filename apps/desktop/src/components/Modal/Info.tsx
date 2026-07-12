import NiceModal, { useModal } from '@ebay/nice-modal-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { useTranslation } from '@/i18n'

export interface InfoModalProps {
  title?: string
  content?: ReactNode
  onResolve?: () => void
  width?: string
}

export const MODAL_INFO_ID = 'modal-info'

export function InfoModal({ title, content, onResolve, width }: InfoModalProps) {
  const modal = useModal()
  const { t } = useTranslation()
  const settledRef = useRef(false)
  const finalizedRef = useRef(false)
  const [open, setOpen] = useState(modal.visible)
  const shouldDescribeContent = typeof content === 'string' || typeof content === 'number'

  useEffect(() => {
    if (!modal.visible) return
    settledRef.current = false
    finalizedRef.current = false
    setOpen(true)
  }, [modal.visible])

  const handleClose = () => {
    if (settledRef.current) return
    settledRef.current = true
    setOpen(false)
  }

  const finalizeClose = () => {
    if (finalizedRef.current) return
    finalizedRef.current = true

    try {
      onResolve?.()
    } finally {
      modal.resolve()
      void modal.hide()
      modal.remove()
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose()
      }}
    >
      <Dialog.Content
        {...(shouldDescribeContent ? {} : { 'aria-describedby': undefined })}
        closeLabel={t('common.close')}
        onCloseAutoFocus={finalizeClose}
        style={width ? { maxWidth: 'calc(100vw - 2rem)', width } : undefined}
      >
        <Dialog.Header>
          <Dialog.Title>{title ?? t('app_name')}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          {shouldDescribeContent ? (
            <Dialog.Description asChild>
              <div className='text-foreground-secondary'>{content}</div>
            </Dialog.Description>
          ) : (
            <div className='text-foreground-secondary'>{content}</div>
          )}
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export const Info = NiceModal.create(InfoModal)
