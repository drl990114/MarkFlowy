import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAuiState,
} from '@assistant-ui/react'
import { AlertCircleIcon, FileTextIcon, LoaderCircleIcon, XIcon } from 'lucide-react'
import type { FC } from 'react'
import { cn } from '@/lib/cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TooltipIconButton } from './tooltip-icon-button'

export type AttachmentChipProps = {
  removable?: boolean
  errors?: Readonly<Record<string, string>>
  removeLabel?: string
  unavailableLabel?: string
}

export const AttachmentChip: FC<AttachmentChipProps> = ({
  removable = false,
  errors,
  removeLabel = 'Remove',
  unavailableLabel = 'Attachment unavailable',
}) => {
  const attachmentId = useAuiState((state) => state.attachment.id)
  const status = useAuiState((state) => state.attachment.status)
  const isRunning = status.type === 'running'
  const adapterError = status.type === 'incomplete' && status.reason === 'error'
  const errorMessage = errors?.[attachmentId] ?? (adapterError ? unavailableLabel : undefined)
  const isError = Boolean(errorMessage)

  return (
    <Tooltip>
      <AttachmentPrimitive.Root
        className={cn(
          'group flex h-7 max-w-56 shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted px-2 text-xs text-foreground',
          isError && 'border-destructive text-destructive',
        )}
      >
        <TooltipTrigger asChild>
          <span className='flex min-w-0 items-center gap-1.5'>
            {isRunning ? (
              <LoaderCircleIcon className='size-3.5 shrink-0 animate-spin' />
            ) : isError ? (
              <AlertCircleIcon className='size-3.5 shrink-0' />
            ) : (
              <FileTextIcon className='size-3.5 shrink-0 text-muted-foreground' />
            )}
            <span className='truncate'>
              <AttachmentPrimitive.Name />
            </span>
          </span>
        </TooltipTrigger>
        {removable && (
          <AttachmentPrimitive.Remove asChild>
            <TooltipIconButton className='-me-1 size-5' tooltip={removeLabel}>
              <XIcon className='size-3' />
            </TooltipIconButton>
          </AttachmentPrimitive.Remove>
        )}
      </AttachmentPrimitive.Root>
      <TooltipContent className='aui-tooltip-content' side='top'>
        <AttachmentPrimitive.Name />
        {errorMessage ? <span className='ms-1 text-destructive'>{errorMessage}</span> : null}
      </TooltipContent>
    </Tooltip>
  )
}

export type ComposerAttachmentsProps = Pick<
  AttachmentChipProps,
  'errors' | 'removeLabel' | 'unavailableLabel'
> & { removable?: boolean }

export const ComposerAttachments: FC<ComposerAttachmentsProps> = ({
  removable = true,
  ...props
}) => (
  <div className='flex w-full gap-1.5 overflow-x-auto empty:hidden'>
    <ComposerPrimitive.Attachments>
      {() => <AttachmentChip removable={removable} {...props} />}
    </ComposerPrimitive.Attachments>
  </div>
)

export const UserMessageAttachments: FC = () => (
  <div className='col-span-full flex w-full justify-end gap-1.5 overflow-x-auto empty:hidden'>
    <MessagePrimitive.Attachments>{() => <AttachmentChip />}</MessagePrimitive.Attachments>
  </div>
)
