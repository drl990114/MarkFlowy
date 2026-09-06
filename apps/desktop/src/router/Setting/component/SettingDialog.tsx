import { Dialog, type DialogContentProps } from '@/components/ui/dialog'
import { useTranslation } from '@/i18n'
import type { PropsWithChildren } from 'react'
import { useNavigate } from 'react-router'

export type SettingDialogProps = PropsWithChildren<Pick<DialogContentProps, 'onEscapeKeyDown'>>

export function SettingDialog({ children, onEscapeKeyDown }: SettingDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) navigate('/', { replace: true })
      }}
    >
      <Dialog.Content
        aria-describedby={undefined}
        aria-modal='true'
        className='h-[92dvh] max-h-[100dvh] w-[96vw] max-w-none gap-0 rounded-xl p-0 max-[719px]:h-dvh max-[719px]:w-screen max-[719px]:rounded-none max-[719px]:border-0'
        closeLabel={t('common.close')}
        data-mf-settings-surface=''
        onCloseAutoFocus={(event) => {
          // The route controller restores editor focus after the workspace becomes active.
          event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (event.isComposing || event.repeat) {
            event.preventDefault()
            return
          }
          onEscapeKeyDown?.(event)
        }}
      >
        <Dialog.Title className='sr-only'>{t('settings.label')}</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Root>
  )
}
