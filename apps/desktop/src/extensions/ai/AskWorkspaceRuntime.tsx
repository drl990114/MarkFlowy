import { commandRegistry } from '@/commands'
import type { RightNavItem } from '@/components/SideBar/SideBarHeader'
import { EVENT } from '@/constants'
import { useTranslation } from '@/i18n'
import { dialog } from '@/services/dialog'
import { addNewMarkdownFileEdit } from '@/services/editor-file'
import {
  AssistantRuntimeProvider,
  useAui,
  useAuiState,
  useLocalRuntime,
  type AssistantClient,
  type AssistantRuntime,
  type ThreadHistoryAdapter,
} from '@assistant-ui/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  TauriAskThreadHistoryAdapter,
  deleteHistoryMessages,
  exportAskHistoryMarkdown,
  migrateLegacyAskStorage,
} from './askHistory'
import { createAskModelAdapter } from './askModelAdapter'
import type { EditorContextErrorCode } from './editorContext'
import { EditorContextAttachmentAdapter } from './editorContextAttachmentAdapter'
import { createAIModelKey, normalizeAIProviderId } from './aiProvidersService'
import { setPreferredAIModelKey } from './aiModelPreference'
import { useAskModelCatalog } from './useAskModelCatalog'

export interface AskRuntimeSession {
  aui: AssistantClient
  runtime: AssistantRuntime
  attachmentAdapter: EditorContextAttachmentAdapter
  modelState: ReturnType<typeof useAskModelCatalog>
  isPreparing: boolean
  isMutatingHistory: boolean
  attachmentErrors: Record<string, string>
  readyToSend: boolean
  handleComposerSubmit: (event: FormEvent<HTMLFormElement>) => void
  handleDeleteTurn: (messageId: string) => void
  handleRightNavItemClick: (item: RightNavItem) => void
}

interface AskWorkspaceRuntimeProps {
  workspaceKey: string
  onSessionChange: (session: AskRuntimeSession) => void
}

const AskWorkspaceRuntime = memo(function AskWorkspaceRuntime({
  workspaceKey,
  onSessionChange,
}: AskWorkspaceRuntimeProps) {
  const attachmentAdapter = useMemo(() => new EditorContextAttachmentAdapter(), [])
  const chatModel = useMemo(() => createAskModelAdapter(), [])
  const history = useMemo(() => createMigratingHistoryAdapter(workspaceKey), [workspaceKey])
  const runtime = useLocalRuntime(chatModel, {
    adapters: { attachments: attachmentAdapter, history },
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AskSessionController
        attachmentAdapter={attachmentAdapter}
        history={history}
        onSessionChange={onSessionChange}
        runtime={runtime}
      />
    </AssistantRuntimeProvider>
  )
})

export default AskWorkspaceRuntime

function createMigratingHistoryAdapter(workspaceKey: string) {
  const adapter = new TauriAskThreadHistoryAdapter(workspaceKey)
  let migration: Promise<void> | undefined
  const ensureMigration = () => {
    migration ??= migrateLegacyAskStorage({
      workspaceKey,
      setModelPreference: (provider, model) => {
        const providerId = normalizeAIProviderId(provider)
        if (providerId && model.trim()) {
          setPreferredAIModelKey(createAIModelKey(providerId, model))
        }
      },
    })
      .then(() => undefined)
      .catch(() => undefined)
    return migration
  }

  return {
    load: async () => {
      await ensureMigration()
      return adapter.load()
    },
    append: (item) => adapter.append(item),
    delete: (items) => adapter.delete(items),
    clear: () => adapter.clear(),
    setHead: (headId: string | null | undefined) => adapter.setHead(headId),
  } satisfies ThreadHistoryAdapter & {
    clear: () => Promise<void>
    setHead: (headId: string | null | undefined) => Promise<void>
  }
}

type AskHistory = ReturnType<typeof createMigratingHistoryAdapter>

function AskSessionController({
  attachmentAdapter,
  history,
  onSessionChange,
  runtime,
}: {
  attachmentAdapter: EditorContextAttachmentAdapter
  history: AskHistory
  onSessionChange: (session: AskRuntimeSession) => void
  runtime: AssistantRuntime
}) {
  const { t } = useTranslation()
  const api = useAui()
  const modelState = useAskModelCatalog()
  const composerAttachments = useAuiState((state) => state.composer.attachments)
  const [isPreparing, setIsPreparing] = useState(false)
  const [isMutatingHistory, setIsMutatingHistory] = useState(false)
  const [attachmentErrors, setAttachmentErrors] = useState<Record<string, string>>({})
  const preparingRef = useRef(false)
  const historyMutationRef = useRef(false)
  const mountedRef = useRef(false)
  const submissionEpochRef = useRef(0)
  const readyToSend = modelState.selectedModel?.status === 'ready'

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      submissionEpochRef.current += 1
      preparingRef.current = false
      historyMutationRef.current = false
      attachmentAdapter.reset()
      runtime.thread.cancelRun()
    }
  }, [attachmentAdapter, runtime.thread])

  useEffect(() => {
    const getHeadId = () => runtime.thread.getState().messages.at(-1)?.id
    let previousHeadId = getHeadId()
    return runtime.thread.subscribe(() => {
      const headId = getHeadId()
      if (headId === previousHeadId) return
      previousHeadId = headId
      void history.setHead(headId)
    })
  }, [history, runtime.thread])

  useEffect(() => {
    const activeIds = new Set(composerAttachments.map(({ id }) => id))
    setAttachmentErrors((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([attachmentId]) => activeIds.has(attachmentId)),
      )
      return Object.keys(next).length === Object.keys(current).length ? current : next
    })
  }, [composerAttachments])

  const handleComposerSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (
        preparingRef.current ||
        historyMutationRef.current ||
        !readyToSend ||
        !modelState.selectedModelKey
      ) {
        return
      }

      const submissionEpoch = ++submissionEpochRef.current
      preparingRef.current = true
      setIsPreparing(true)
      setAttachmentErrors({})
      const composer = api.composer()
      const submittedState = composer.getState()
      const submittedText = submittedState.text
      const submittedAttachmentIds = submittedState.attachments.map(({ id }) => id)
      void attachmentAdapter
        .prepare(submittedState.attachments)
        .then((result) => {
          if (!mountedRef.current || submissionEpochRef.current !== submissionEpoch) return

          const currentState = composer.getState()
          if (
            currentState.text !== submittedText ||
            !sameStringArray(
              currentState.attachments.map(({ id }) => id),
              submittedAttachmentIds,
            )
          ) {
            return
          }

          if (!result.ok) {
            setAttachmentErrors(
              Object.fromEntries(
                result.failures.flatMap((failure) =>
                  failure.attachmentId
                    ? [[failure.attachmentId, getAttachmentError(t, failure.code)]]
                    : [],
                ),
              ),
            )
            return
          }

          composer.setRunConfig({
            custom: {
              modelKey: modelState.selectedModelKey,
            },
          })
          composer.send()
          setAttachmentErrors({})
        })
        .finally(() => {
          if (!mountedRef.current || submissionEpochRef.current !== submissionEpoch) return
          preparingRef.current = false
          setIsPreparing(false)
        })
    },
    [api, attachmentAdapter, modelState.selectedModelKey, readyToSend, t],
  )

  const handleDeleteTurn = useCallback(
    (messageId: string) => {
      if (preparingRef.current || historyMutationRef.current) return
      const repository = runtime.thread.export()
      const current = repository.messages.find(({ message }) => message.id === messageId)
      if (!current) return
      const userId =
        current.message.role === 'user'
          ? current.message.id
          : repository.messages.find(({ message }) => message.id === current.parentId)?.message
                .role === 'user'
            ? current.parentId
            : undefined
      if (!userId) return

      const removedIds = new Set([userId])
      repository.messages.forEach((item) => {
        if (item.parentId === userId && item.message.role === 'assistant') {
          removedIds.add(item.message.id)
        }
      })
      const removedItems = repository.messages.filter(({ message }) => removedIds.has(message.id))
      const next = deleteHistoryMessages(repository, removedIds)
      historyMutationRef.current = true
      setIsMutatingHistory(true)
      void history
        .delete(removedItems)
        .then(() => {
          if (mountedRef.current) runtime.thread.import(next)
        })
        .catch(() => undefined)
        .finally(() => {
          historyMutationRef.current = false
          if (mountedRef.current) setIsMutatingHistory(false)
        })
    },
    [history, runtime.thread],
  )

  const startNewConversation = useCallback(async () => {
    if (historyMutationRef.current) return
    const action = await dialog.confirm({
      title: t('ai.new_chat_confirm_title'),
      content: t('ai.new_chat_confirm_description'),
      actions: [
        { id: 'cancel', label: t('ai.cancel') },
        { id: 'confirm', label: t('ai.new_chat_confirm'), primary: true, danger: true },
      ],
    })
    if (action !== 'confirm' || !mountedRef.current || historyMutationRef.current) return

    const resetEpoch = ++submissionEpochRef.current
    preparingRef.current = false
    historyMutationRef.current = true
    setIsPreparing(false)
    setIsMutatingHistory(true)
    try {
      runtime.thread.cancelRun()
      await waitForThreadIdle(runtime)
      if (!mountedRef.current || submissionEpochRef.current !== resetEpoch) return
      await history.clear()
      if (!mountedRef.current || submissionEpochRef.current !== resetEpoch) return
      api.composer().reset()
      attachmentAdapter.reset()
      runtime.thread.reset()
      setAttachmentErrors({})
    } catch {
      return
    } finally {
      historyMutationRef.current = false
      if (mountedRef.current) setIsMutatingHistory(false)
    }
  }, [api, attachmentAdapter, history, runtime, t])

  const exportConversation = useCallback(async () => {
    if (historyMutationRef.current) return
    const repository = runtime.thread.export()
    const markdown = exportAskHistoryMarkdown(repository)
    if (!markdown) {
      await dialog.info({ title: t('ai.export_conversation'), content: t('ai.export_empty') })
      return
    }
    await addNewMarkdownFileEdit({ fileName: 'ai-ask.md', content: markdown })
  }, [runtime.thread, t])

  const handleRightNavItemClick = useCallback(
    (item: RightNavItem) => {
      if (item.key === 'newChat') void startNewConversation()
      else if (item.key === 'exportChats') void exportConversation()
      else if (item.key === 'settings') {
        commandRegistry.execute(EVENT.app_openSetting, { category: 'ai' })
      }
    },
    [exportConversation, startNewConversation],
  )

  const session = useMemo<AskRuntimeSession>(() => ({
    aui: api,
    runtime,
    attachmentAdapter,
    modelState,
    isPreparing,
    isMutatingHistory,
    attachmentErrors,
    readyToSend,
    handleComposerSubmit,
    handleDeleteTurn,
    handleRightNavItemClick,
  }), [
    api,
    runtime,
    attachmentAdapter,
    modelState,
    isPreparing,
    isMutatingHistory,
    attachmentErrors,
    readyToSend,
    handleComposerSubmit,
    handleDeleteTurn,
    handleRightNavItemClick,
  ])

  useEffect(() => onSessionChange(session), [onSessionChange, session])
  return null
}

function sameStringArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

async function waitForThreadIdle(runtime: AssistantRuntime): Promise<void> {
  if (!runtime.thread.getState().isRunning) return

  await new Promise<void>((resolve) => {
    let unsubscribe: () => void = () => undefined
    const finishIfIdle = () => {
      if (runtime.thread.getState().isRunning) return
      unsubscribe()
      resolve()
    }
    unsubscribe = runtime.thread.subscribe(finishIfIdle)
    finishIfIdle()
  })
}

function getAttachmentError(
  t: ReturnType<typeof useTranslation>['t'],
  code: EditorContextErrorCode,
) {
  const keys: Record<EditorContextErrorCode, string> = {
    missing: 'ai.attachment_missing',
    unreadable: 'ai.attachment_unreadable',
    binary: 'ai.attachment_binary',
    'too-many-files': 'ai.attachment_too_many',
  }
  return t(keys[code])
}

