import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { logger } from '@/helper/logger'
import { useGlobalKeyboard } from '@/hooks'
import type { KeyboardInfo } from '@/hooks/useKeyboard'
import { useTranslation } from '@/i18n'
import type { KeyboardEvent as ReactKeyboardEvent, Ref } from 'react'
import { useImperativeHandle, useRef, useState } from 'react'
import { recordKey, transferKey } from './record-key'

export interface RecordKeysModalRef {
  open: (command: KeyboardInfo) => void
}

interface RecordKeysModalProps {
  ref?: Ref<RecordKeysModalRef>
}

export function RecordKeysModal({ ref }: RecordKeysModalProps) {
  const { updateKeyBinding } = useGlobalKeyboard()
  const [open, setOpen] = useState(false)
  const [newKeyBinding, setNewKeyBinding] = useState<string[]>([])
  const [selectedCommand, setSelectedCommand] = useState<KeyboardInfo | null>(null)
  const { t } = useTranslation()
  const modalRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    open: (command) => {
      setSelectedCommand(command)
      setOpen(true)
    },
  }))

  const handleClose = () => {
    setSelectedCommand(null)
    setNewKeyBinding([])
    setOpen(false)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!selectedCommand) return

    const { keys, isExit } = recordKey(event.nativeEvent)

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
      logger.error('保存快捷键失败:', error)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose()
      }}
    >
      <Dialog.Content
        aria-describedby={undefined}
        closeLabel={t('common.close')}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          modalRef.current?.focus()
        }}
      >
        <Dialog.Header>
          <Dialog.Title>Edit Shortcut</Dialog.Title>
        </Dialog.Header>

        {selectedCommand && (
          <Dialog.Body>
            <div className='grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-4'>
              <span className='text-right text-xs font-medium text-foreground-secondary'>
                Command
              </span>
              <span className='min-w-0 break-all text-foreground'>{selectedCommand.id}</span>

              <span className='text-right text-xs font-medium text-foreground-secondary'>
                Description
              </span>
              <span className='min-w-0 text-foreground'>{t(selectedCommand.id)}</span>

              <label
                className='text-right text-xs font-medium text-foreground-secondary'
                htmlFor='shortcut-input'
              >
                Shortcut
              </label>
              <Input
                aria-label='Shortcut'
                id='shortcut-input'
                onKeyDown={handleKeyDown}
                placeholder='请按下快捷键'
                readOnly
                ref={modalRef}
                value={newKeyBinding.length ? transferKey(newKeyBinding.join('+')) : ''}
              />
            </div>
          </Dialog.Body>
        )}

        <Dialog.Footer>
          <Button onClick={handleClose} variant='outline'>
            {t('common.cancel')}
          </Button>
          <Button disabled={!selectedCommand} onClick={() => void handleSave()}>
            Save
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  )
}
