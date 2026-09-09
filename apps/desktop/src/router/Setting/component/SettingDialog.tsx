import { Dialog, type DialogContentProps } from '@/components/ui/dialog'
import { useTranslation } from '@/i18n'
import { useRef, useState, type PropsWithChildren } from 'react'
import { useNavigate } from 'react-router'
import './SettingDialog.css'

export type SettingDialogProps = PropsWithChildren<Pick<DialogContentProps, 'onEscapeKeyDown'>>

export function SettingDialog({ children, onEscapeKeyDown }: SettingDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  const closeRequested = useRef(false)

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        closeRequested.current = !nextOpen
        setOpen(nextOpen)
      }}
    >
      <Dialog.Content
        aria-describedby={undefined}
        aria-modal='true'
        className='h-[92dvh] max-h-[100dvh] w-[96vw] max-w-none gap-0 rounded-xl p-0 max-[719px]:h-dvh max-[719px]:w-screen max-[719px]:rounded-none max-[719px]:border-0'
        closeLabel={t('common.close')}
        data-mf-settings-surface=''
        onCloseAutoFocus={(event) => {
          // Radix waits for the exit animation before releasing the focus scope.
          // Then the route controller makes the workspace active and restores editor focus.
          event.preventDefault()
          if (closeRequested.current) navigate('/', { replace: true })
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
