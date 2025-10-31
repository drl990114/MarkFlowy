import { useGlobalKeyboard } from '@/hooks'
import { KeyboardInfo } from '@/hooks/useKeyboard'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import styled from 'styled-components'
import { Button, Dialog, Input } from 'zens'
import { recordKey, transferKey } from './record-key'

const FormLabel = styled.div`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-top: 16px;
  margin-bottom: 8px;
  color: ${(props) => props.theme.labelFontColor};
`

const FormValue = styled.div`
  margin-bottom: 8px;
  color: ${(props) => props.theme.primaryFontColor};
`

const FormActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 24px;
  justify-content: flex-end;
`

interface RecordKeysModalProps {}
export interface RecordKeysModalRef {
  open: (command: KeyboardInfo) => void
}

export const RecordKeysModal = forwardRef<RecordKeysModalRef, RecordKeysModalProps>((_, ref) => {
  const { updateKeyBinding } = useGlobalKeyboard()
  const [open, setOpen] = useState(false)
  const [newKeyBinding, setNewKeyBinding] = useState<string[]>([])
  const [selectedCommand, setSelectedCommand] = useState<KeyboardInfo | null>(null)
  const modalRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => {
    return {
      open: (command) => {
        setSelectedCommand(command)
        setOpen(true)
      },
    }
  })

  useEffect(() => {
    const modalElement = modalRef.current
    if (modalElement && open) {
      setTimeout(() => modalRef.current?.focus(), 100)
      modalElement.addEventListener('keydown', handleKeyDown, true)
    }

    return () => {
      if (modalElement) {
        modalElement.removeEventListener('keydown', handleKeyDown, true)
      }
    }
  }, [open])

  const handleClose = () => {
    setSelectedCommand(null)
    setNewKeyBinding([])
    setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!selectedCommand) return

    const { keys, isEnter, isExit} = recordKey(event)

    if (keys === null || isExit) {
      setNewKeyBinding([])
    } else {
      setNewKeyBinding(keys)
    }
  }

  const handleSave = async () => {
    if (!selectedCommand) return

    try {
      await updateKeyBinding(selectedCommand.id, newKeyBinding)
      handleClose()
    } catch (error) {
      console.error('保存快捷键失败:', error)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title='Edit Shortcut'>
      <div>
        {selectedCommand && (
          <div>
            <FormLabel>Command:</FormLabel>
            <FormValue>{selectedCommand.id}</FormValue>

            <FormLabel>Description:</FormLabel>
            <FormValue>{selectedCommand.desc}</FormValue>

            <FormLabel>Shortcut:</FormLabel>
            <Input inputRef={modalRef} placeholder='请按下快捷键' value={newKeyBinding.length ? transferKey(newKeyBinding.join('+')) : ''} readOnly />

            <FormActions>
              <Button onClick={handleSave} btnType='primary'>
                Save
              </Button>
            </FormActions>
          </div>
        )}
      </div>
    </Dialog>
  )
})
