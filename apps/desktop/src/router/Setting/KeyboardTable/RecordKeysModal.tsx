import { Button } from '@/components/ui/button'
import { Dialog, type DialogContentProps } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { sameKeyMap, formatKeyMap } from '@/commands/keybindingKeys'
import { useGlobalKeyboard } from '@/hooks'
import type { KeyboardInfo } from '@/hooks/useKeyboard'
import { useTranslation } from '@/i18n'
import { RotateCcw, Trash2 } from 'lucide-react'
import type { KeyboardEvent as ReactKeyboardEvent, Ref } from 'react'
import { useId, useImperativeHandle, useRef, useState } from 'react'
import { recordKey } from './record-key'
import { ShortcutKeys } from './ShortcutKeys'

export interface RecordKeysModalRef {
  open: (binding: KeyboardInfo) => void
}
interface RecordKeysModalProps {
  ref?: Ref<RecordKeysModalRef>
  onCloseAutoFocus?: DialogContentProps['onCloseAutoFocus']
}

export function RecordKeysModal({ ref, onCloseAutoFocus }: RecordKeysModalProps) {
  const { updateKeyBinding, validateKeyBinding } = useGlobalKeyboard()
  const [selectedBinding, setSelectedBinding] = useState<KeyboardInfo | null>(null)
  const [newKeyBinding, setNewKeyBinding] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const feedbackId = useId()
  const helpId = useId()
  const { t } = useTranslation()
  useImperativeHandle(ref, () => ({
    open: (binding) => {
      if (!binding.configurable) return
      setSelectedBinding(binding)
      setNewKeyBinding([...binding.keys])
      setSaveError(undefined)
    },
  }))
  const close = () => {
    if (!savingRef.current) setSelectedBinding(null)
  }
  const change = (keys: string[]) => {
    setSaveError(undefined)
    setNewKeyBinding(keys)
    inputRef.current?.focus()
  }
  const problem = selectedBinding
    ? validateKeyBinding(selectedBinding.id, newKeyBinding)
    : undefined
  const changed = selectedBinding && !sameKeyMap(selectedBinding.keys, newKeyBinding)
  const handleSave = async () => {
    if (!selectedBinding || savingRef.current || !changed || problem) return
    savingRef.current = true
    setSaving(true)
    try {
      if (await updateKeyBinding(selectedBinding.id, newKeyBinding)) setSelectedBinding(null)
      else setSaveError(t('settings.keyboard.save_failed'))
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('settings.keyboard.save_failed'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (saving) return
    if (
      event.key === 'Enter' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      event.stopPropagation()
      void handleSave()
      return
    }
    const keys = recordKey(event.nativeEvent)
    if (keys) change(keys)
  }
  return (
    <Dialog.Root
      open={Boolean(selectedBinding)}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <Dialog.Content
        size='sm'
        className='gap-3 p-4'
        closeLabel={t('common.close')}
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <Dialog.Header>
          <Dialog.Title className='text-ui-body'>
            {selectedBinding && t(`command.id_descriptions.${selectedBinding.command}`)}
          </Dialog.Title>
          <Dialog.Description className='sr-only'>
            {t('settings.keyboard.edit_shortcut')}
          </Dialog.Description>
        </Dialog.Header>
        {selectedBinding && (
          <Dialog.Body>
            <div>
              <div className='relative'>
                <Input
                  ref={inputRef}
                  className='h-16 cursor-default bg-background shadow-none text-transparent caret-transparent focus-visible:border-control-focus disabled:text-transparent'
                  readOnly
                  disabled={saving}
                  onKeyDown={handleKeyDown}
                  aria-label={t('settings.keyboard.shortcut')}
                  aria-invalid={Boolean(problem || saveError)}
                  aria-describedby={`${feedbackId} ${helpId}`}
                  value={formatKeyMap(newKeyBinding)}
                />
                <div
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-0 flex items-center justify-center px-3'
                >
                  <ShortcutKeys keys={newKeyBinding} />
                </div>
              </div>
              <p id={helpId} className='m-0 mt-2 text-center text-ui-caption text-muted-foreground'>
                {t('settings.keyboard.record_help')}
              </p>
              <div className='mt-3 flex flex-wrap items-center justify-between gap-1'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='px-1.5 text-muted-foreground'
                  disabled={saving || sameKeyMap(newKeyBinding, selectedBinding.defaultKeys)}
                  onClick={() => change([...selectedBinding.defaultKeys])}
                >
                  <RotateCcw aria-hidden='true' className='size-3.5' />
                  {t('settings.keyboard.reset_default')}
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='px-1.5 text-muted-foreground'
                  disabled={saving || !newKeyBinding.length}
                  onClick={() => change([])}
                >
                  <Trash2 aria-hidden='true' className='size-3.5' />
                  {t('settings.keyboard.remove_binding')}
                </Button>
              </div>
              {selectedBinding.command === 'editor_cut' && (
                <p className='m-0 mt-2 text-ui-caption text-muted-foreground'>
                  {t('settings.keyboard.clipboard_note')}
                </p>
              )}
              <div
                id={feedbackId}
                role='status'
                aria-live='polite'
                className='text-ui-control text-destructive'
              >
                {(saveError || problem) && <p className='m-0 mt-2'>{saveError || problem}</p>}
              </div>
            </div>
          </Dialog.Body>
        )}
        <Dialog.Footer className='mt-0'>
          <Button onClick={close} disabled={saving} variant='ghost' size='sm'>
            {t('common.cancel')}
          </Button>
          <Button
            size='sm'
            disabled={saving || !changed || Boolean(problem)}
            onClick={() => void handleSave()}
          >
            {t(saving ? 'settings.keyboard.saving' : 'settings.keyboard.save')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  )
}
