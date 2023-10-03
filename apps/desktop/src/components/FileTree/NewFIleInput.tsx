import bus from '@/helper/eventBus'
import type { IFile } from '@/helper/filesys'
import { useEditorStore } from '@/stores'
import {
  useCallback,
  type HTMLAttributes,
  useState,
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useMemo,
} from 'react'
import { Input } from '../UI/Input'
import { Validity } from '../Validity'
import { unVerifiedFileNameChars, verifyFileName } from './verify-file-name'
import { EVENT } from '@/constants'

export type NewInputRef = {
  show: (args: { fileNode: IFile }) => void
}

const InvalidTextMap = {
  same: 'has same file',
  empty: 'file name can not be empty',
  invalid: `invalid file name, file name can not include ${unVerifiedFileNameChars.join(' ')}`,
}

const NewFileInput = forwardRef<NewInputRef, HTMLAttributes<HTMLInputElement>>((props, ref) => {
  const { className, style, ...otherProps } = props
  const [visible, setVisible] = useState(false)
  const [inputName, setInputName] = useState('')
  const contextFileNode = useRef<IFile>()
  const [invalidState, setInvalidState] = useState(false)
  const [invalidText, setInvalidText] = useState(InvalidTextMap.same)
  const { addFile } = useEditorStore()

  const styleProps = useMemo(() => ({ className, style }), [className, style])

  const hideInput = useCallback(() => {
    setVisible(false)
    setInputName('')
  }, [])

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        document.addEventListener('click', hideInput)
      })
    }

    return () => {
      document.removeEventListener('click', hideInput)
    }
  }, [visible, hideInput])

  useEffect(() => {
    bus.on(EVENT.sidebar_show_new_input, hideInput)

    return () => {
      bus.detach(EVENT.sidebar_show_new_input, hideInput)
    }
  }, [hideInput])

  useImperativeHandle(ref, () => ({
    show({ fileNode }) {
      setVisible(true)
      contextFileNode.current = fileNode
    },
  }))

  const handleKeyup: React.KeyboardEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      event.preventDefault()
      if (!event.shiftKey && event.keyCode === 13) {
        if (!contextFileNode.current) return
        if (inputName === '') {
          setInvalidText(InvalidTextMap.empty)
          setInvalidState(true)
          setTimeout(() => {
            setInvalidState(false)
          }, 2000)
          return
        } else if (verifyFileName(inputName) === false) {
          setInvalidText(InvalidTextMap.invalid)
          setInvalidState(true)
          setTimeout(() => {
            setInvalidState(false)
          }, 2000)
          return
        }

        const res = addFile(contextFileNode.current, { name: inputName, kind: 'file' })

        if (res === false) {
          setInvalidText(InvalidTextMap.same)
          setInvalidState(true)
          setTimeout(() => {
            setInvalidState(false)
          }, 2000)
          return
        }

        hideInput()
        return false
      }
    },
    [addFile, inputName, hideInput],
  )

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
    setInputName(e.target.value)
  }, [])

  const stopPropagation: React.ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
    e.stopPropagation()
  }, [])

  if (!visible) return null

  return (
    <Validity invalidText={invalidText} invalidState={invalidState} {...styleProps}>
      <Input
        value={inputName}
        onChange={handleChange}
        onKeyUp={handleKeyup}
        onClick={stopPropagation}
        aria-invalid={true}
        {...otherProps}
      ></Input>
    </Validity>
  )
})

export default NewFileInput
