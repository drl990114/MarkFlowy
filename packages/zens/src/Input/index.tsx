import type { KeyboardEventHandler, Ref } from 'react'
import { Slot } from 'radix-ui'
import {
  Input as ComponentInput,
  type InputProps as ComponentInputProps,
} from '../components/input'
import { cn } from '../lib/cn'

export type InputSize = 'small' | 'medium' | 'large'

export interface InputProps extends Omit<ComponentInputProps, 'size'> {
  inputRef?: Ref<HTMLInputElement>
  onPressEnter?: (event: KeyboardEvent) => void
  size?: InputSize
}

const InputRefSlot = Slot.createSlot<HTMLInputElement>('Input')
const sizes = { small: 'sm', medium: 'default', large: 'lg' } as const

export default function Input({
  ref,
  inputRef,
  onPressEnter,
  size = 'medium',
  className,
  onKeyDown,
  ...props
}: InputProps) {
  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (
      event.key === 'Enter' &&
      !event.nativeEvent.isComposing &&
      event.nativeEvent.keyCode !== 229
    ) {
      onPressEnter?.(event.nativeEvent)
    }
    onKeyDown?.(event)
  }

  return (
    <InputRefSlot ref={ref}>
      <ComponentInput
        {...props}
        className={cn('mfc:data-[error=true]:border-destructive mfc:read-only:bg-muted', className)}
        inputSize={sizes[size]}
        ref={inputRef}
        onKeyDown={handleKeyDown}
      />
    </InputRefSlot>
  )
}
