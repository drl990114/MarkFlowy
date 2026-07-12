import NiceModal, { useModal } from '@ebay/nice-modal-react'
import type { ReactNode } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/ui/dialog'
import { useTranslation } from '@/i18n'

export interface DialogAction {
  id: string
  label: ReactNode
  primary?: boolean
  danger?: boolean
  disabled?: boolean
  autoFocus?: boolean
}

export interface DialogRememberOptions {
  key: string
  label?: ReactNode
  enabled?: boolean
}

export interface ConfirmModalProps {
  title?: string
  content?: ReactNode
  describeContent?: boolean
  actions?: DialogAction[]
  remember?: DialogRememberOptions
  onResolve?: (actionId: string | null) => void
  onRemember?: (actionId: string) => void | Promise<void>
}

export const MODAL_CONFIRM_ID = 'modal-confirm'

export function ConfirmModal({
  title,
  content,
  describeContent,
  actions,
  remember,
  onResolve,
  onRemember,
}: ConfirmModalProps) {
  const modal = useModal()
  const { t } = useTranslation()
  const rememberId = useId()
  const settledRef = useRef(false)
  const finalizedRef = useRef(false)
  const resultRef = useRef<string | null>(null)
  const [open, setOpen] = useState(modal.visible)
  const [isResolving, setIsResolving] = useState(false)
  const [rememberChecked, setRememberChecked] = useState(false)
  const hasContent = content !== undefined && content !== null
  const shouldDescribeContent =
    describeContent ?? (typeof content === 'string' || typeof content === 'number')

  useEffect(() => {
    if (!modal.visible) return
    settledRef.current = false
    finalizedRef.current = false
    resultRef.current = null
    setOpen(true)
  }, [modal.visible])

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

  const startClose = (actionId: string | null) => {
    resultRef.current = actionId
    setRememberChecked(false)
    setIsResolving(false)
    setOpen(false)
  }

  const finalizeClose = () => {
    if (finalizedRef.current) return
    finalizedRef.current = true

    const result = resultRef.current
    try {
      onResolve?.(result)
    } finally {
      modal.resolve(result)
      void modal.hide()
      modal.remove()
    }
  }

  const handleAction = async (action: DialogAction) => {
    if (settledRef.current) return

    settledRef.current = true
    setIsResolving(true)

    try {
      if (remember?.enabled !== false && rememberChecked) {
        await onRemember?.(action.id)
      }
      startClose(action.id)
    } catch {
      settledRef.current = false
      setIsResolving(false)
    }
  }

  const handleClose = () => {
    if (settledRef.current) return
    settledRef.current = true
    startClose(null)
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose()
      }}
    >
      <Dialog.Content
        {...(hasContent && shouldDescribeContent ? {} : { 'aria-describedby': undefined })}
        closeLabel={t('common.close')}
        onCloseAutoFocus={finalizeClose}
        onOpenAutoFocus={(event) => {
          const autoFocusTarget = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(
            '[data-dialog-autofocus=true]',
          )
          if (!autoFocusTarget) return
          event.preventDefault()
          autoFocusTarget.focus()
        }}
      >
        <Dialog.Header>
          <Dialog.Title>{title ?? t('app_name')}</Dialog.Title>
        </Dialog.Header>

        {hasContent ? (
          <Dialog.Body>
            {shouldDescribeContent ? (
              <Dialog.Description asChild>
                <div className='text-foreground-secondary'>{content}</div>
              </Dialog.Description>
            ) : (
              <div className='text-foreground-secondary'>{content}</div>
            )}
          </Dialog.Body>
        ) : null}

        <Dialog.Footer className={remember?.enabled !== false && remember ? 'justify-between' : ''}>
          {remember?.enabled !== false && remember ? (
            <label
              className='flex min-w-0 cursor-pointer items-center gap-2 text-xs text-foreground-secondary select-none'
              htmlFor={rememberId}
            >
              <Checkbox
                checked={rememberChecked}
                disabled={isResolving}
                id={rememberId}
                onCheckedChange={(checked) => setRememberChecked(checked === true)}
              />
              <span>{remember.label ?? t('dialog.remember_choice')}</span>
            </label>
          ) : null}

          <div className='ml-auto flex flex-wrap items-center justify-end gap-2'>
            {normalizedActions.map((action) => (
              <Button
                data-dialog-autofocus={action.autoFocus ? 'true' : undefined}
                disabled={action.disabled || isResolving}
                key={action.id}
                onClick={() => void handleAction(action)}
                variant={
                  action.danger ? 'destructive' : action.primary ? 'default' : 'outline'
                }
              >
                {action.label}
              </Button>
            ))}
          </div>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export const Confirm = NiceModal.create(ConfirmModal)
