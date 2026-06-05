import NiceModal, { useModal } from '@ebay/nice-modal-react'
import React, { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@markflowy/i18n'
import type { InputProps } from 'zens'
import { Input } from 'zens'
import { ConfirmModal } from './Confirm'

export const MODAL_INPUT_ID = 'modal-input'

export interface InputConfirmModalProps {
  title?: string
  inputProps?: InputProps
  onResolve?: (val: string | null) => void
}

export const InputConfirmModal = memo((props: InputConfirmModalProps) => {
  const { inputProps, ...restProps } = props
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { t } = useTranslation()
  const modal = useModal()

  useEffect(() => {
    if (modal.visible && inputRef.current) {
      inputRef.current.focus()
    }
  }, [modal.visible])

  const handleConfirm = () => {
    props.onResolve?.(inputVal)
    setInputVal('')
    modal.hide()
  }

  const handleResolve = (actionId: string | null) => {
    if (actionId === 'confirm') {
      handleConfirm()
      return
    }
    props.onResolve?.(null)
    setInputVal('')
  }

  return (
    <ConfirmModal
      {...restProps}
      actions={[
        { id: 'cancel', label: t('common.cancel') },
        { id: 'confirm', label: t('common.confirm'), primary: true },
      ]}
      content={
        <Input
          {...inputProps}
          inputRef={inputRef}
          className='flex1'
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(event) => {
            inputProps?.onKeyDown?.(event)
            if (event.defaultPrevented) return
            if (event.key === 'Enter') {
              event.preventDefault()
              handleConfirm()
            }
          }}
        />
      }
      onResolve={handleResolve}
    />
  )
})

export const InputConfirm = NiceModal.create(InputConfirmModal)
