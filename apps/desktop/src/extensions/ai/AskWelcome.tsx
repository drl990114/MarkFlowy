import { useTranslation } from '@/i18n'
import useEditorStore from '@/stores/useEditorStore'
import { useAui } from '@assistant-ui/react'
import { FileTextIcon, LightbulbIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './components/ui/button'
import {
  getActiveEditorContextReference,
  getEditorContextIdentity,
  MAX_EDITOR_CONTEXT_FILES,
} from './editorContext'
import type { EditorContextAttachmentAdapter } from './editorContextAttachmentAdapter'

export function AskWelcome() {
  const { t } = useTranslation()

  return (
    <div className='aui-welcome flex flex-col items-center px-3 text-center'>
      <h2 className='text-lg font-semibold'>{t('ai.welcome_title')}</h2>
    </div>
  )
}

export function AskSuggestions({
  attachmentAdapter,
  disabled,
}: {
  attachmentAdapter: EditorContextAttachmentAdapter
  disabled: boolean
}) {
  const { t } = useTranslation()
  const api = useAui()
  useEditorStore((state) => state.activeId)
  const activeReference = getActiveEditorContextReference()

  const selectPrompt = async (kind: 'document' | 'explain') => {
    if (disabled) return
    const composer = api.composer()
    if (kind === 'document') {
      if (activeReference) {
        const identity = getEditorContextIdentity(activeReference)
        const composerState = composer.getState()
        const alreadyAttached = composerState.attachments.some(({ id }) => {
          const reference = attachmentAdapter.getReference(id)
          return reference && getEditorContextIdentity(reference) === identity
        })
        if (!alreadyAttached && composerState.attachments.length < MAX_EDITOR_CONTEXT_FILES) {
          try {
            await composer.addAttachment(attachmentAdapter.createFile(activeReference))
          } catch {
            return
          }
        }
      }
      composer.setText(t('ai.prompt_document_value'))
      return
    }
    composer.setText(t('ai.prompt_explain_value'))
  }

  return (
    <div className='flex w-full flex-wrap items-center justify-center gap-1.5 px-1'>
      <WelcomePrompt
        disabled={disabled || !activeReference}
        icon={<FileTextIcon className='size-3.5' />}
        onClick={() => void selectPrompt('document')}
        title={t('ai.prompt_document_title')}
      />
      <WelcomePrompt
        disabled={disabled}
        icon={<LightbulbIcon className='size-3.5' />}
        onClick={() => void selectPrompt('explain')}
        title={t('ai.prompt_explain_title')}
      />
    </div>
  )
}

function WelcomePrompt({
  disabled,
  icon,
  onClick,
  title,
}: {
  disabled?: boolean
  icon: ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <Button
      className='h-7 shrink-0 gap-1.5 whitespace-nowrap rounded-md border border-border px-2.5 text-xs font-normal'
      disabled={disabled}
      onClick={onClick}
      type='button'
      variant='ghost'
    >
      {icon}
      <span>{title}</span>
    </Button>
  )
}
