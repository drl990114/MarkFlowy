import { XIcon } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useFileSystem, type IFile } from '@markflowy/interface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import useFileCacheStore from '@/helper/files'
import { useTranslation } from '@/i18n'
import { guardUnsavedFiles } from '@/services/checkUnsavedFiles'
import { renameDocument, RenameDocumentError } from '@/services/rename-document'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'

export function DocumentTitle() {
  const id = useEditorStore((state) => state.activeId)
  const file = useFileCacheStore((state) => (id ? state.entries[id] : undefined))
  const dirty = useEditorStateStore((state) =>
    Boolean(id && state.idStateMap.get(id)?.hasUnsavedChanges),
  )

  return file ? <DocumentTitleActions key={file.id} file={file} dirty={dirty} /> : null
}

function DocumentTitleActions({ file, dirty }: { file: IFile; dirty: boolean }) {
  const { t } = useTranslation()
  const [renaming, setRenaming] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const name =
    !file.path && file.name === `${t('file.untitled')}.md` ? t('file.untitled') : file.name

  useLayoutEffect(() => {
    if (!renaming && restoreFocus.current) {
      restoreFocus.current = false
      triggerRef.current?.focus({ preventScroll: true })
    }
  }, [renaming])

  const finishRename = (focus: boolean) => {
    restoreFocus.current = focus
    setRenaming(false)
  }

  return (
    <div
      className='group/document-title flex min-w-0 items-center gap-1 text-ui-control font-medium text-content-primary'
      data-slot='document-title'
      title={file.path}
    >
      {renaming ? (
        <DocumentNameInput file={file} onFinish={finishRename} />
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={triggerRef}
              aria-label={`${t('contextmenu.explorer.rename')}: ${name}`}
              className='h-6 min-w-0 shrink px-1.5'
              data-slot='document-rename-trigger'
              size='sm'
              variant='ghost'
              onClick={() => setRenaming(true)}
            >
              <span className='truncate'>{name}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('contextmenu.explorer.rename')}</TooltipContent>
        </Tooltip>
      )}
      <span className='w-2 shrink-0 text-ui-caption'>{dirty ? '•' : null}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={t('file.closeDocument')}
            data-slot='document-close-trigger'
            size='icon-chrome'
            variant='chrome'
            onClick={() => {
              const groupId = useEditorStore.getState().activeGroupId
              if (!groupId) return
              guardUnsavedFiles({
                fileIds: [file.id],
                onContinue: () => useEditorStore.getState().closeFileInGroup(groupId, file.id),
              })
            }}
          >
            <XIcon
              aria-hidden='true'
              className='opacity-0 group-hover/document-title:opacity-100 group-focus-within/document-title:opacity-100 [@media(hover:none)]:opacity-100'
              size={14}
              strokeWidth={1.75}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('file.closeDocument')}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function DocumentNameInput({
  file,
  onFinish,
}: {
  file: IFile
  onFinish: (restoreFocus: boolean) => void
}) {
  const { t } = useTranslation()
  const fileSystem = useFileSystem()
  // Keep the identity captured when editing began, even if Save As changes it.
  const [target] = useState(() => ({ id: file.id, path: file.path, name: file.name }))
  const [value, setValue] = useState(file.name)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const cancelled = useRef(false)
  const composing = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    const input = inputRef.current
    input?.focus({ preventScroll: true })
    const extensionStart = target.name.lastIndexOf('.')
    input?.setSelectionRange(0, extensionStart > 0 ? extensionStart : target.name.length)
  }, [target.name])

  const submit = async (focus: boolean) => {
    if (submitting.current || cancelled.current || composing.current) return
    submitting.current = true
    setPending(true)
    setError('')
    try {
      await renameDocument(target, value, fileSystem)
      onFinish(focus && document.activeElement === inputRef.current)
    } catch (cause) {
      setError(
        cause instanceof RenameDocumentError
          ? t(`file.renameErrors.${cause.code}`)
          : cause instanceof Error
            ? cause.message
            : String(cause),
      )
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <Tooltip open={Boolean(error)}>
      <TooltipTrigger asChild>
        <Input
          ref={inputRef}
          aria-label={t('contextmenu.explorer.rename')}
          aria-invalid={Boolean(error)}
          aria-busy={pending}
          className='h-6 max-w-full px-1.5'
          inputSize='sm'
          readOnly={pending}
          spellCheck={false}
          style={{ width: `${Math.min(36, Math.max(12, value.length + 2))}ch` }}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError('')
          }}
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={() => {
            composing.current = false
          }}
          onBlur={() => {
            void submit(false)
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return
            if (event.key === 'Escape' && !submitting.current) {
              event.preventDefault()
              cancelled.current = true
              onFinish(true)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              void submit(true)
            }
          }}
        />
      </TooltipTrigger>
      <TooltipContent>
        <span role='alert'>{error}</span>
      </TooltipContent>
    </Tooltip>
  )
}
