import {
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from '@assistant-ui/react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SquareIcon,
  Trash2Icon,
} from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  type ComponentProps,
  type FC,
  type FormEventHandler,
  type KeyboardEventHandler,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { ComposerAttachments, UserMessageAttachments } from './attachment'
import { DotMatrix } from './dot-matrix'
import { MarkdownText } from './markdown-text'
import { Sources } from './sources'
import { TooltipIconButton } from './tooltip-icon-button'

export type ThreadLabels = {
  scrollToBottom: string
  composerPlaceholder: string
  send: string
  stop: string
  copy: string
  copied: string
  regenerate: string
  edit: string
  deleteTurn: string
  previousBranch: string
  nextBranch: string
  cancel: string
  update: string
  removeAttachment: string
  attachmentUnavailable: string
  working: string
}

const DEFAULT_LABELS: ThreadLabels = {
  scrollToBottom: 'Scroll to bottom',
  composerPlaceholder: 'Ask anything…',
  send: 'Send',
  stop: 'Stop',
  copy: 'Copy',
  copied: 'Copied',
  regenerate: 'Regenerate',
  edit: 'Edit',
  deleteTurn: 'Delete turn',
  previousBranch: 'Previous branch',
  nextBranch: 'Next branch',
  cancel: 'Cancel',
  update: 'Update',
  removeAttachment: 'Remove attachment',
  attachmentUnavailable: 'Attachment unavailable',
  working: 'Assistant is working',
}

type ThreadContextValue = {
  labels: ThreadLabels
  composerTriggers?: ReactNode
  composerTools?: ReactNode
  composerDisabled: boolean
  attachmentsRemovable: boolean
  onComposerSubmit?: FormEventHandler<HTMLFormElement>
  onDeleteTurn?: (messageId: string) => void
  attachmentErrors?: Readonly<Record<string, string>>
}

const ThreadContext = createContext<ThreadContextValue>({
  labels: DEFAULT_LABELS,
  composerDisabled: false,
  attachmentsRemovable: true,
})

const isNewChatView = (state: AssistantState) =>
  state.thread.messages.length === 0 && (!state.thread.isLoading || state.threads.isLoading)

export type ThreadProps = {
  className?: string
  welcome?: ReactNode
  suggestions?: ReactNode
  composerTriggers?: ReactNode
  composerTools?: ReactNode
  composerDisabled?: boolean
  attachmentsRemovable?: boolean
  labels?: Partial<ThreadLabels>
  onComposerSubmit?: FormEventHandler<HTMLFormElement>
  onDeleteTurn?: (messageId: string) => void
  attachmentErrors?: Readonly<Record<string, string>>
}

export const Thread: FC<ThreadProps> = ({
  className,
  welcome,
  suggestions,
  composerTriggers,
  composerTools,
  composerDisabled = false,
  attachmentsRemovable = true,
  labels: labelsProp,
  onComposerSubmit,
  onDeleteTurn,
  attachmentErrors,
}) => {
  const labels = { ...DEFAULT_LABELS, ...labelsProp }
  const isEmpty = useAuiState(isNewChatView)

  return (
    <ThreadContext.Provider
      value={{
        labels,
        composerTriggers,
        composerTools,
        composerDisabled,
        attachmentsRemovable,
        onComposerSubmit,
        onDeleteTurn,
        attachmentErrors,
      }}
    >
      <ThreadPrimitive.Root
        className={cn(
          'aui-thread-root @container flex h-full min-h-0 flex-col bg-background',
          className,
        )}
      >
        <ThreadPrimitive.Viewport
          className='aui-thread-viewport relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto scroll-smooth'
          turnAnchor='top'
        >
          <div
            className={cn(
              'mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 pt-2',
              isEmpty && 'justify-center pb-2',
            )}
          >
            <AuiIf condition={isNewChatView}>
              {welcome ? <div className='mb-4'>{welcome}</div> : null}
            </AuiIf>

            <div className='flex flex-col gap-4 pb-4 empty:hidden'>
              <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
            </div>

            <ThreadPrimitive.ViewportFooter
              className={cn(
                'z-10 flex flex-col gap-2 bg-background pb-2 pt-1',
                !isEmpty && 'sticky bottom-0 mt-auto rounded-t-lg',
              )}
            >
              <ThreadScrollToBottom />
              <Composer />
              {isEmpty && suggestions ? (
                <AuiIf condition={(state) => state.composer.isEmpty}>{suggestions}</AuiIf>
              ) : null}
            </ThreadPrimitive.ViewportFooter>
          </div>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </ThreadContext.Provider>
  )
}

function ThreadMessage() {
  const role = useAuiState((state) => state.message.role)
  const editing = useAuiState((state) => state.message.composer.isEditing)

  if (editing) return <EditComposer />
  return role === 'user' ? <UserMessage /> : <AssistantMessage />
}

export function ThreadScrollToBottom() {
  const { labels } = useContext(ThreadContext)
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        className='absolute -top-10 self-center rounded-full border border-border bg-background shadow-sm disabled:invisible'
        tooltip={labels.scrollToBottom}
      >
        <ArrowDownIcon className='size-4' />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  )
}

export function Composer() {
  const {
    labels,
    composerTriggers,
    composerTools,
    composerDisabled,
    attachmentsRemovable,
    onComposerSubmit,
    attachmentErrors,
  } = useContext(ThreadContext)
  const canSend = useAuiState((state) => state.composer.canSend)
  const handleComposerKeyDown = useCallback<KeyboardEventHandler<HTMLTextAreaElement>>(
    (event) => {
      const isShiftEnter =
        event.key === 'Enter' && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
      if (!isShiftEnter || event.defaultPrevented || event.nativeEvent.isComposing) return

      event.preventDefault()
      if (event.repeat || !canSend) return
      event.currentTarget.form?.requestSubmit()
    },
    [canSend],
  )

  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <ComposerPrimitive.Root
        className='relative flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-sm transition-colors focus-within:border-ring'
        onSubmit={onComposerSubmit}
      >
        {composerTriggers}
        <ComposerAttachments
          errors={attachmentErrors}
          removable={attachmentsRemovable}
          removeLabel={labels.removeAttachment}
          unavailableLabel={labels.attachmentUnavailable}
        />
        <ComposerPrimitive.Input
          addAttachmentOnPaste={false}
          aria-label={labels.composerPlaceholder}
          autoFocus
          className='max-h-32 min-h-8 w-full resize-none bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground'
          disabled={composerDisabled}
          enterKeyHint='enter'
          onKeyDown={handleComposerKeyDown}
          placeholder={labels.composerPlaceholder}
          rows={1}
          submitMode='none'
        />
        <div className='flex min-h-7 items-center justify-between gap-1.5'>
          <div className='flex min-w-0 flex-1 items-center gap-1 overflow-x-auto'>
            {composerTools}
          </div>
          <ComposerAction />
        </div>
      </ComposerPrimitive.Root>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  )
}

const COMPOSER_SEND_BUTTON_CLASS_NAME =
  'size-7 rounded-lg bg-primary text-primary-foreground enabled:hover:opacity-90 disabled:bg-secondary disabled:text-disabled-foreground disabled:opacity-100'

function ComposerAction() {
  const { labels, composerDisabled, onComposerSubmit } = useContext(ThreadContext)
  const canSend = useAuiState((state) => state.composer.canSend)

  return (
    <div className='flex shrink-0 items-center'>
      <AuiIf condition={(state) => !state.thread.isRunning}>
        {onComposerSubmit ? (
          <TooltipIconButton
            className={COMPOSER_SEND_BUTTON_CLASS_NAME}
            disabled={composerDisabled || !canSend}
            tooltip={labels.send}
            type='submit'
          >
            <ArrowUpIcon className='size-4' />
          </TooltipIconButton>
        ) : (
          <ComposerPrimitive.Send asChild>
            <TooltipIconButton
              className={COMPOSER_SEND_BUTTON_CLASS_NAME}
              disabled={composerDisabled}
              tooltip={labels.send}
            >
              <ArrowUpIcon className='size-4' />
            </TooltipIconButton>
          </ComposerPrimitive.Send>
        )}
      </AuiIf>
      <AuiIf condition={(state) => state.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <TooltipIconButton
            className='size-7 rounded-lg bg-primary text-primary-foreground hover:opacity-90'
            tooltip={labels.stop}
          >
            <SquareIcon className='size-3 fill-current' />
          </TooltipIconButton>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </div>
  )
}

const messagePartComponents: ComponentProps<typeof MessagePrimitive.Parts>['components'] = {
  Text: MarkdownText,
  Source: Sources,
}

export function AssistantMessage() {
  const isWaiting = useAuiState(
    (state) =>
      state.message.status?.type === 'running' &&
      state.message.content.every((part) => part.type === 'text' && part.text.trim().length === 0),
  )
  const { labels } = useContext(ThreadContext)

  return (
    <MessagePrimitive.Root className='aui-message group relative px-0.5 pb-6 text-sm [content-visibility:auto]'>
      <div className='leading-relaxed text-foreground'>
        {isWaiting ? (
          <div className='flex min-h-6 items-center text-primary'>
            <DotMatrix className='size-4' label={labels.working} state='thinking' />
          </div>
        ) : (
          <MessagePrimitive.Parts components={messagePartComponents} />
        )}
        <MessageError />
      </div>
      <div className='absolute bottom-0 start-0 flex min-h-6 items-center'>
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  )
}

const MESSAGE_ACTION_BUTTON_CLASS_NAME =
  'size-[22px] rounded-md text-muted-foreground hover:text-foreground [&_svg]:size-3'

function AssistantActionBar() {
  const { composerDisabled, labels } = useContext(ThreadContext)

  return (
    <ActionBarPrimitive.Root
      autohide='not-last'
      className='flex items-center gap-px text-muted-foreground'
      hideWhenRunning
    >
      <ActionBarPrimitive.Copy asChild>
        <CopyAction className={MESSAGE_ACTION_BUTTON_CLASS_NAME} />
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton
          className={MESSAGE_ACTION_BUTTON_CLASS_NAME}
          disabled={composerDisabled}
          tooltip={labels.regenerate}
        >
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <DeleteTurnButton className={MESSAGE_ACTION_BUTTON_CLASS_NAME} />
    </ActionBarPrimitive.Root>
  )
}

export function UserMessage() {
  return (
    <MessagePrimitive.Root className='aui-message group grid grid-cols-[minmax(4rem,1fr)_auto] gap-y-1 px-0.5 [content-visibility:auto]'>
      <UserMessageAttachments />
      <div className='relative col-start-2 min-w-0 max-w-full pb-6'>
        <div className='rounded-lg bg-muted px-2.5 py-1.5 text-sm text-foreground'>
          <MessagePrimitive.Parts components={messagePartComponents} />
        </div>
        <div className='absolute end-0 bottom-0 flex min-h-6 w-max items-center'>
          <BranchPicker />
          <UserActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

function UserActionBar() {
  const { composerDisabled, labels } = useContext(ThreadContext)
  return (
    <ActionBarPrimitive.Root
      autohide='not-last'
      className='flex items-center gap-px text-muted-foreground'
      hideWhenRunning
    >
      <ActionBarPrimitive.Copy asChild>
        <CopyAction className={MESSAGE_ACTION_BUTTON_CLASS_NAME} />
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton
          className={MESSAGE_ACTION_BUTTON_CLASS_NAME}
          disabled={composerDisabled}
          tooltip={labels.edit}
        >
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
      <DeleteTurnButton className={MESSAGE_ACTION_BUTTON_CLASS_NAME} />
    </ActionBarPrimitive.Root>
  )
}

function CopyAction(props: Omit<ComponentProps<typeof TooltipIconButton>, 'tooltip'>) {
  const copied = useAuiState((state) => state.message.isCopied)
  const { labels } = useContext(ThreadContext)
  return (
    <TooltipIconButton tooltip={copied ? labels.copied : labels.copy} {...props}>
      {copied ? <CheckIcon className='size-3.5' /> : <CopyIcon className='size-3.5' />}
    </TooltipIconButton>
  )
}

function DeleteTurnButton({ className }: { className?: string } = {}) {
  const messageId = useAuiState((state) => state.message.id)
  const { composerDisabled, labels, onDeleteTurn } = useContext(ThreadContext)
  if (!onDeleteTurn) return null

  return (
    <TooltipIconButton
      className={className}
      disabled={composerDisabled}
      onClick={() => onDeleteTurn(messageId)}
      tooltip={labels.deleteTurn}
    >
      <Trash2Icon className='size-3.5' />
    </TooltipIconButton>
  )
}

function MessageError() {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className='mt-2 rounded-md border border-destructive bg-muted p-2 text-xs text-destructive'>
        <ErrorPrimitive.Message />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  )
}

export function EditComposer() {
  const { composerDisabled, labels } = useContext(ThreadContext)

  return (
    <MessagePrimitive.Root className='px-0.5'>
      <ComposerPrimitive.Root className='ms-auto flex max-w-[90%] flex-col rounded-lg border border-border bg-card p-2 shadow-sm'>
        <ComposerPrimitive.Input
          addAttachmentOnPaste={false}
          autoFocus
          className='min-h-12 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none'
          disabled={composerDisabled}
        />
        <div className='mt-1 flex justify-end gap-1.5'>
          <ComposerPrimitive.Cancel asChild>
            <Button size='sm' variant='ghost'>
              {labels.cancel}
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button disabled={composerDisabled} size='sm'>
              {labels.update}
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  )
}

export function BranchPicker({
  className,
  ...props
}: ComponentProps<typeof BranchPickerPrimitive.Root>) {
  const { composerDisabled, labels } = useContext(ThreadContext)

  return (
    <BranchPickerPrimitive.Root
      className={cn(
        'flex shrink-0 items-center whitespace-nowrap text-xs text-muted-foreground',
        className,
      )}
      hideWhenSingleBranch
      {...props}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton
          className={MESSAGE_ACTION_BUTTON_CLASS_NAME}
          disabled={composerDisabled}
          tooltip={labels.previousBranch}
        >
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className='shrink-0 whitespace-nowrap px-0.5 font-medium'>
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton
          className={MESSAGE_ACTION_BUTTON_CLASS_NAME}
          disabled={composerDisabled}
          tooltip={labels.nextBranch}
        >
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  )
}
