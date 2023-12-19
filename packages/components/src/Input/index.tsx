import { forwardRef, useEffect, useRef } from 'react'
import styled from 'styled-components'

const InputComponent = styled.input`
  line-height: 22px;
  padding: 6px 4px 6px 5px;
  border: 1px solid;
  color: ${(props) => props.theme.primaryFontColor};
  border-color: ${(props) => props.theme.borderColor};
  background-color: ${(props) => props.theme.bgColor};
  border-radius: ${(props) => props.theme.smallBorderRadius};

  &:focus {
    outline: 2px solid ${(props) => props.theme.accentColor};
  }

  &[data-disabled='true'] {
    background-color: ${(props) => props.theme.tipsBgColor};
    cursor: not-allowed;
  }
`

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onPressEnter?: (e: KeyboardEvent) => void
}

const Input: React.FC<InputProps> = forwardRef((props) => {
  const { onPressEnter, ...rest } = props
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        onPressEnter?.(e)
      }
    }
    inputRef.current?.addEventListener('keydown', handleKeyDown)

    return () => {
      inputRef.current?.removeEventListener('keydown', handleKeyDown)
    }
  }, [onPressEnter])

  return <InputComponent ref={inputRef} {...rest} />
})

export default Input
