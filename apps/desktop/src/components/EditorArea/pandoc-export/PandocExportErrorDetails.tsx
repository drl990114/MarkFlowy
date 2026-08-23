import { Button } from '@/components/ui/button'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { isPandocError, type PandocError } from './pandocExport'

export interface PandocErrorDetailLabels {
  code: string
  exitCode: string
  message: string
  details: string
}

export function normalizePandocError(
  error: unknown,
  fallbackMessage: string,
): PandocError {
  if (isPandocError(error)) return error

  let detail: string | undefined
  if (error instanceof Error) {
    detail = error.stack || error.message
  } else if (typeof error === 'string') {
    detail = error
  } else if (error !== undefined) {
    try {
      detail = JSON.stringify(error, null, 2)
    } catch {
      detail = String(error)
    }
  }

  return {
    code: 'conversion_failed',
    message: error instanceof Error ? error.message : fallbackMessage,
    detail,
  }
}

export function formatPandocErrorDetails(
  error: PandocError,
  summary: string,
  labels: PandocErrorDetailLabels,
): string {
  const sections = [summary, `${labels.code}: ${error.code}`]

  if (error.exitCode !== undefined) {
    sections.push(`${labels.exitCode}: ${error.exitCode}`)
  }
  if (error.message) {
    sections.push(`${labels.message}:\n${error.message}`)
  }
  if (error.detail) {
    sections.push(`${labels.details}:\n${error.detail}`)
  }

  return sections.join('\n\n')
}

export interface PandocExportErrorDetailsProps {
  details: string
  copyLabel: string
  copiedLabel: string
  copyFailedLabel: string
}

export function PandocExportErrorDetails({
  details,
  copyLabel,
  copiedLabel,
  copyFailedLabel,
}: PandocExportErrorDetailsProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copyDetails = async () => {
    try {
      await writeText(details)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  const copied = copyStatus === 'copied'

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      <pre
        className='m-0 max-h-[50vh] max-w-full overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-background p-3 font-mono text-ui-caption leading-relaxed text-foreground select-text'
        dir='auto'
      >
        {details}
      </pre>
      <div className='flex min-w-0 flex-wrap items-center justify-end gap-2'>
        {copyStatus === 'failed' ? (
          <span className='text-ui-caption text-destructive' role='status'>
            {copyFailedLabel}
          </span>
        ) : null}
        <Button
          aria-label={copied ? copiedLabel : copyLabel}
          onClick={() => void copyDetails()}
          size='sm'
          variant='outline'
        >
          {copied ? (
            <CheckIcon className='size-3.5' aria-hidden='true' />
          ) : (
            <CopyIcon className='size-3.5' aria-hidden='true' />
          )}
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
    </div>
  )
}
