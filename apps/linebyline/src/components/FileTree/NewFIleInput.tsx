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
} from 'react'

export type NewInputRef = {
  show: (args: { fileNode: IFile }) => void
}

const NewFileInput = forwardRef<NewInputRef, HTMLAttributes<HTMLInputElement>>((props, ref) => {
  const [visible, setVisible] = useState(false)
  const [inputName, setInputName] = useState('')
  const contextFileNode = useRef<IFile>()
  const { addFile } = useEditorStore()

  const hideInput = useCallback( () => {
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
    bus.on('SIDEBAR:hide-new-input', hideInput)

    return () => {
      bus.detach('SIDEBAR:hide-new-input', hideInput)
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
      if (!event.shiftKey && event.keyCode === 13) {
        if (!contextFileNode.current) return
        const res = addFile(contextFileNode.current, { name: inputName, kind: 'file' })

        if (res === false) {
          // TODO has same file
        }

        hideInput()
        event.preventDefault()
        return false
      }
    },
    [addFile, inputName, hideInput],
  )

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
    setInputName(e.target.value)
  }, [])

  if (!visible) return null

  return (
    <input
      className='newfile-input'
      value={inputName}
      onChange={handleChange}
      onKeyUp={handleKeyup}
      {...props}
    ></input>
  )
})

export default NewFileInput
