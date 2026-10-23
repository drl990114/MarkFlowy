import { commandRegistry } from '@/commands'
import type { RightBarItem } from '@/components/SideBar'
import { AsyncSurface, type AsyncSurfaceState } from '@/components/AsyncSurface'
import SideBarHeader from '@/components/SideBar/SideBarHeader'
import { DockPanelMenu } from '@/components/SideBar/DockPanelMenu'
import { Button } from '@/components/ui/button'
import { EVENT, RIGHTBARITEMKEYS } from '@/constants'
import { useTranslation } from '@/i18n'
import { AuiProvider, ThreadPrimitive } from '@assistant-ui/react'
import { FileDownIcon, PlusIcon, Settings2Icon, SparklesIcon } from 'lucide-react'
import { useMemo } from 'react'
import { AskComposerTools, AskComposerTriggers } from './AskComposerTools'
import { AskSuggestions, AskWelcome } from './AskWelcome'
import { useAskRuntimeSession } from './AskRuntimeHost'
import type { AskRuntimeSession } from './AskWorkspaceRuntime'
import { resolveAskModelSurfaceStatus } from './askModelSurfaceState'
import {
  AssistantLinkProvider,
  AssistantUIThemeProvider,
  MarkdownTextProvider,
  Thread,
} from './components/assistant-ui'
import { openAiLink } from './MarkdownLink'
import { Container } from './styles'

function AskPanel() {
  const { t } = useTranslation()
  const session = useAskRuntimeSession()
  if (!session) {
    return (
      <AsyncSurface state={{ status: 'loading', label: t('ai.working') }}>
        {() => null}
      </AsyncSurface>
    )
  }

  return (
    <AuiProvider value={session.aui}>
      <ThreadPrimitive.ViewportProvider>
        <AssistantUIThemeProvider className='flex h-full min-h-0 flex-col'>
          <AssistantLinkProvider openLink={async (href) => void (await openAiLink(href))}>
            <MarkdownTextProvider copyCode={t('ai.copy')} copiedCode={t('ai.copied')}>
              <AskWorkspaceContent session={session} />
            </MarkdownTextProvider>
          </AssistantLinkProvider>
        </AssistantUIThemeProvider>
      </ThreadPrimitive.ViewportProvider>
    </AuiProvider>
  )
}

function AskWorkspaceContent({ session }: { session: AskRuntimeSession }) {
  const { t } = useTranslation()
  const {
    attachmentAdapter,
    modelState,
    isPreparing,
    isMutatingHistory,
    attachmentErrors,
    readyToSend,
    handleComposerSubmit,
    handleDeleteTurn,
    handleRightNavItemClick,
  } = session
  const interactionDisabled = isPreparing || isMutatingHistory
  const { refreshOllama } = modelState
  const modelSurfaceStatus = resolveAskModelSurfaceStatus({
    hasReadyModel: modelState.catalog.models.some((model) => model.status === 'ready'),
    ollamaStatus: modelState.ollamaStatus,
  })
  const modelSurfaceState = useMemo<AsyncSurfaceState<true>>(() => {
    if (modelSurfaceStatus === 'ready') return { status: 'ready', data: true }
    if (modelSurfaceStatus === 'loading') {
      return { status: 'loading', label: t('ai.ollama_connecting') }
    }
    if (modelSurfaceStatus === 'error') {
      return {
        status: 'error',
        title: t('ai.ollama_offline'),
        description: t('ai.model_unavailable'),
        retry: () => void refreshOllama(),
      }
    }
    return {
      status: 'blocked',
      title: t('ai.no_models_configured'),
      description: t('ai.select_available_model'),
      action: (
        <Button onClick={() => commandRegistry.execute(EVENT.app_openSetting, { category: 'ai' })}>
          {t('ai.manage_providers')}
        </Button>
      ),
    }
  }, [modelSurfaceStatus, refreshOllama, t])

  return (
    <Container>
      <SideBarHeader
        actions={<DockPanelMenu panelId='ai' />}
        name={t('ai.assistant')}
        onRightNavItemClick={handleRightNavItemClick}
        rightNavItems={[
          {
            icon: PlusIcon,
            key: 'newChat',
            tooltip: { title: t('ai.new_chat') },
          },
          {
            icon: FileDownIcon,
            key: 'exportChats',
            tooltip: { title: t('ai.export_conversation') },
          },
          {
            icon: Settings2Icon,
            key: 'settings',
            tooltip: { title: t('ai.settings') },
          },
        ]}
      />
      <div className='content'>
        <AsyncSurface retryLabel={t('ai.ollama_retry')} state={modelSurfaceState}>
          {() => (
            <Thread
              attachmentErrors={attachmentErrors}
              composerDisabled={!readyToSend || interactionDisabled}
              composerTriggers={
                <AskComposerTriggers
                  attachmentAdapter={attachmentAdapter}
                  disabled={interactionDisabled}
                />
              }
              composerTools={
                <AskComposerTools disabled={interactionDisabled} modelState={modelState} />
              }
              attachmentsRemovable={!interactionDisabled}
              labels={{
                scrollToBottom: t('ai.scroll_to_bottom'),
                composerPlaceholder: t('ai.ask_placeholder'),
                send: t('ai.send'),
                stop: t('ai.stop'),
                working: t('ai.working'),
                copy: t('ai.copy'),
                copied: t('ai.copied'),
                regenerate: t('ai.regenerate'),
                edit: t('ai.edit'),
                deleteTurn: t('ai.delete'),
                previousBranch: t('ai.previous_branch'),
                nextBranch: t('ai.next_branch'),
                cancel: t('ai.cancel_edit'),
                update: t('ai.save_edit'),
                removeAttachment: t('ai.delete'),
                attachmentUnavailable: t('ai.attachment_unreadable'),
              }}
              onComposerSubmit={handleComposerSubmit}
              onDeleteTurn={handleDeleteTurn}
              welcome={<AskWelcome />}
              suggestions={
                <AskSuggestions
                  attachmentAdapter={attachmentAdapter}
                  disabled={interactionDisabled}
                />
              }
            />
          )}
        </AsyncSurface>
      </div>
    </Container>
  )
}

const AI = {
  title: RIGHTBARITEMKEYS.AI,
  key: RIGHTBARITEMKEYS.AI,
  icon: <SparklesIcon aria-hidden='true' className='size-4' strokeWidth={1.75} />,
  components: <AskPanel />,
} as RightBarItem

export default AI
