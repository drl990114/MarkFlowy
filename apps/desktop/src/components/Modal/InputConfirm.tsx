import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { memo, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, type InputProps } from '@/components/ui/input'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/cn'

export const MODAL_INPUT_ID = 'modal-input'

export interface InputConfirmModalProps {
  title?: string
  inputProps?: InputProps
  onResolve?: (value: string | null) => void
}

export const InputConfirmModal = memo((props: InputConfirmModalProps) => {
  const { inputProps, title, onResolve } = props
  const modal = useModal()
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const settledRef = useRef(false)
  const finalizedRef = useRef(false)
  const resultRef = useRef<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [open, setOpen] = useState(modal.visible)

  useEffect(() => {
    if (!modal.visible) return
    settledRef.current = false
    finalizedRef.current = false
    resultRef.current = null
    setInputValue('')
    setOpen(true)
  }, [modal.visible])

  const startClose = (value: string | null) => {
    if (settledRef.current) return
    settledRef.current = true
    resultRef.current = value
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

  const inputLabel =
    inputProps?.['aria-label'] ??
    (inputProps?.['aria-labelledby']
      ? undefined
      : inputProps?.placeholder ?? title ?? t('common.value'))

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) startClose(null)
      }}
    >
      <Dialog.Content
        aria-describedby={undefined}
        closeLabel={t('common.close')}
        onCloseAutoFocus={finalizeClose}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <Dialog.Header>
          <Dialog.Title>{title ?? t('app_name')}</Dialog.Title>
        </Dialog.Header>

        <Dialog.Body>
          <Input
            {...inputProps}
            aria-label={inputLabel}
            className={cn('w-full', inputProps?.className)}
            onChange={(event) => {
              inputProps?.onChange?.(event)
              setInputValue(event.target.value)
            }}
            onKeyDown={(event) => {
              inputProps?.onKeyDown?.(event)
              if (event.defaultPrevented) return
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault()
                startClose(inputValue)
              }
            }}
            ref={inputRef}
            value={inputValue}
          />
        </Dialog.Body>

        <Dialog.Footer>
          <Button onClick={() => startClose(null)} variant='outline'>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => startClose(inputValue)}>{t('common.confirm')}</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  )
})

export const InputConfirm = NiceModal.create(InputConfirmModal)
