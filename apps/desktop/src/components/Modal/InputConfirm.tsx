import NiceModal from '@ebay/nice-modal-react'
import { memo, useState } from 'react'
import { Input, InputProps } from 'zens'
import { ConfirmModal } from './Confirm'

export const MODAL_INPUT_ID = 'modal-input'

export interface InputConfirmModalProps {
  title?: string
  confirmText?: string
  cancelText?: string
  inputProps?: InputProps
  onConfirm?: (val: string) => void
}

export const InputConfirmModal = memo((props: InputConfirmModalProps) => {
  const { inputProps, ...restProps } = props
  const [inputVal, setInputVal] = useState('')

  const handleConfirm = () => {
    props.onConfirm?.(inputVal)
    setInputVal('')
  }

  const handleClose = () => {
    setInputVal('')
  }

  return (
    <ConfirmModal
      {...restProps}
      content={
        <Input
          {...inputProps}

          className='flex1'
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
        />
      }
      onConfirm={handleConfirm}
      onClose={handleClose}
    />
  )
})

export const InputConfirm = NiceModal.create(InputConfirmModal)
