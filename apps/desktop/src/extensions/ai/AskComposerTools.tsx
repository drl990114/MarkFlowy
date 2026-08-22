import { useTranslation } from '@/i18n'
import useEditorStore from '@/stores/useEditorStore'
import {
  ComposerPrimitive,
  unstable_useMentionAdapter,
  useAui,
  useAuiState,
  type Unstable_Mention,
  type Unstable_TriggerItem,
} from '@assistant-ui/react'
import { FileTextIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { AskModelSelector, type AskModelCatalogState } from './AskModelSelector'
import {
  getActiveEditorContextReference,
  getEditorContextIdentity,
  getOpenedEditorContextReferences,
  MAX_EDITOR_CONTEXT_FILES,
  type EditorContextReference,
} from './editorContext'
import type { EditorContextAttachmentAdapter } from './editorContextAttachmentAdapter'

export function AskComposerTools({
  disabled,
  modelState,
}: {
  disabled: boolean
  modelState: AskModelCatalogState
}) {
  return <AskModelSelector disabled={disabled} modelState={modelState} />
}

export function AskComposerTriggers({
  attachmentAdapter,
  disabled,
}: {
  attachmentAdapter: EditorContextAttachmentAdapter
  disabled: boolean
}) {
  return <EditorContextMention attachmentAdapter={attachmentAdapter} disabled={disabled} />
}

function EditorContextMention({
  attachmentAdapter,
  disabled,
}: {
  attachmentAdapter: EditorContextAttachmentAdapter
  disabled: boolean
}) {
  const { t } = useTranslation()
  const api = useAui()
  const attachments = useAuiState((state) => state.composer.attachments)
  const activeId = useEditorStore((state) => state.activeId)
  const opened = useEditorStore((state) => state.opened)
  const [adding, setAdding] = useState<ReadonlySet<string>>(new Set())
  const references = useMemo(() => {
    if (!activeId && opened.length === 0) return []

    const openedReferences = getOpenedEditorContextReferences()
    const activeReference = getActiveEditorContextReference()
    if (!activeReference) return openedReferences

    const activeIdentity = getEditorContextIdentity(activeReference)
    return [
      activeReference,
      ...openedReferences.filter(
        (reference) => getEditorContextIdentity(reference) !== activeIdentity,
      ),
    ]
  }, [activeId, opened])
  const selectedIdentities = useMemo(
    () =>
      new Set(
        attachments.flatMap((attachment) => {
          const reference = attachmentAdapter.getReference(attachment.id)
          return reference ? [getEditorContextIdentity(reference)] : []
        }),
      ),
    [attachmentAdapter, attachments],
  )
  const atLimit = attachments.length + adding.size >= MAX_EDITOR_CONTEXT_FILES
  const availableReferences = useMemo(
    () =>
      disabled || atLimit
        ? []
        : references.filter((reference) => {
            const identity = getEditorContextIdentity(reference)
            return !selectedIdentities.has(identity) && !adding.has(identity)
          }),
    [adding, atLimit, disabled, references, selectedIdentities],
  )
  const referencesByIdentity = useMemo(
    () =>
      new Map(
        availableReferences.map(
          (reference) => [getEditorContextIdentity(reference), reference] as const,
        ),
      ),
    [availableReferences],
  )
  const mentionItems = useMemo<Unstable_Mention[]>(
    () =>
      availableReferences.map((reference) => ({
        id: getEditorContextIdentity(reference),
        type: 'file',
        label: reference.name,
        description: reference.path,
      })),
    [availableReferences],
  )
  const mention = unstable_useMentionAdapter({
    items: mentionItems,
    includeModelContextTools: false,
  })

  const addReference = useCallback(
    async (reference: EditorContextReference) => {
      if (disabled || atLimit) return
      const identity = getEditorContextIdentity(reference)
      if (selectedIdentities.has(identity) || adding.has(identity)) return

      setAdding((current) => new Set(current).add(identity))
      try {
        await api.composer().addAttachment(attachmentAdapter.createFile(reference))
      } catch {
        // The attachment adapter owns validation, dedupe, and limits.
      } finally {
        setAdding((current) => {
          const next = new Set(current)
          next.delete(identity)
          return next
        })
      }
    },
    [adding, api, atLimit, attachmentAdapter, disabled, selectedIdentities],
  )

  const handleMention = useCallback(
    (item: Unstable_TriggerItem) => {
      const reference = referencesByIdentity.get(item.id)
      if (reference) void addReference(reference)
    },
    [addReference, referencesByIdentity],
  )

  return (
    <ComposerPrimitive.Unstable_TriggerPopover
      adapter={mention.adapter}
      aria-label={t('ai.add_context')}
      char='@'
      className='aui-popover-content absolute bottom-full start-0 z-[var(--mf-layer-popover)] mb-1.5 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md'
    >
      <ComposerPrimitive.Unstable_TriggerPopover.Action onExecute={handleMention} removeOnExecute />
      <ComposerPrimitive.Unstable_TriggerPopoverItems>
        {(items) => (
          <div className='aui-command-list max-h-48 overflow-y-auto p-1'>
            {items.map((item, index) => {
              const location = item.description
                ? compactReferenceLocation(item.description, item.label)
                : ''
              return (
                <ComposerPrimitive.Unstable_TriggerPopoverItem
                  key={item.id}
                  className='flex min-h-8 w-full cursor-default items-center gap-1.5 rounded-sm px-1.5 py-1 text-start text-xs leading-4 outline-none transition-colors hover:bg-control-hover hover:text-content-primary data-[highlighted]:bg-control-hover data-[highlighted]:text-content-primary'
                  index={index}
                  item={item}
                >
                  <FileTextIcon className='size-3.5 shrink-0 text-muted-foreground' />
                  <span className='flex min-w-0 flex-1 items-baseline gap-2'>
                    <span className='min-w-0 flex-1 truncate font-medium'>{item.label}</span>
                    {location ? (
                      <span
                        className='max-w-[45%] shrink truncate text-ui-caption text-muted-foreground'
                        title={item.description}
                      >
                        {location}
                      </span>
                    ) : null}
                  </span>
                </ComposerPrimitive.Unstable_TriggerPopoverItem>
              )
            })}
            {items.length === 0 ? (
              <div className='flex min-h-10 items-center justify-center px-2 py-3 text-center text-ui-caption text-muted-foreground'>
                {atLimit ? t('ai.context_limit_reached') : t('ai.no_context_files_available')}
              </div>
            ) : null}
          </div>
        )}
      </ComposerPrimitive.Unstable_TriggerPopoverItems>
    </ComposerPrimitive.Unstable_TriggerPopover>
  )
}

function compactReferenceLocation(path: string, fileName: string) {
  const segments = path.replace(/\\/g, '/').replace(/\/+$/, '').split('/').filter(Boolean)
  if (segments.at(-1) === fileName) segments.pop()
  return segments.slice(-2).join('/')
}
