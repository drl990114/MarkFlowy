import NiceModal from '@ebay/nice-modal-react'
import { useEffect, useState } from 'react'
import type { IFile } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { useTranslation } from '@/i18n'
import {
  summarizeFolderForDeletion,
  type FolderDeletionSummary,
} from '@/services/file-deletion'
import { ConfirmModal } from '@/components/Modal/Confirm'
import { Button } from '@/components/ui/button'

export interface FileDeletionConfirmProps {
  file: Pick<IFile, 'name' | 'path' | 'kind'>
  mode: 'permanent' | 'trash'
}

type SummaryState =
  | { status: 'loading' }
  | { status: 'ready'; summary: FolderDeletionSummary }
  | { status: 'error' }

export function FileDeletionConfirmModal({ file, mode }: FileDeletionConfirmProps) {
  const { t } = useTranslation()
  const [summaryState, setSummaryState] = useState<SummaryState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const isFolder = file.kind === 'dir'

  useEffect(() => {
    if (!isFolder) return
    let current = true
    setSummaryState({ status: 'loading' })
    const read = file.path
      ? summarizeFolderForDeletion(file.path)
      : Promise.reject(new Error('Missing folder path'))
    void read.then(
      (summary) => {
        if (current) setSummaryState({ status: 'ready', summary })
      },
      (error: unknown) => {
        if (!current) return
        logger.error('Failed to summarize folder for deletion', error)
        setSummaryState({ status: 'error' })
      },
    )
    return () => { current = false }
  }, [isFolder, file.path, attempt])

  let summaryText = t('file_deletion.counting')
  if (summaryState.status === 'ready') {
    const { summary } = summaryState
    if (summary.isSymlink) summaryText = t('file_deletion.symlink')
    else if (!summary.complete) {
      summaryText = t('file_deletion.short_partial', { files: summary.files, folders: summary.folders })
    } else if (summary.files === 0 && summary.folders === 0) summaryText = t('file_deletion.empty')
    else if (summary.folders === 0) summaryText = t('file_deletion.files_only', { files: summary.files })
    else if (summary.files === 0) summaryText = t('file_deletion.folders_only', { folders: summary.folders })
    else summaryText = t('file_deletion.counts', { files: summary.files, folders: summary.folders })
  }
  const summary = summaryState.status === 'ready' ? summaryState.summary : undefined

  return (
    <ConfirmModal
      title={t(`file_deletion.${mode}_title`, { name: file.name })}
      describeContent
      content={
        <div className='space-y-4'>
          {file.path ? (
            <p className='m-0 text-ui-body text-muted-foreground [overflow-wrap:anywhere]' dir='ltr' title={file.path}>
              {file.path}
            </p>
          ) : null}
          {isFolder ? (
            <div className='space-y-1.5' aria-live='polite' aria-busy={summaryState.status === 'loading'}>
              {summaryState.status === 'error' ? (
                <div className='space-y-2'>
                  <p className='m-0 text-foreground' role='alert'>{t('file_deletion.count_failed')}</p>
                  <Button onClick={() => setAttempt((value) => value + 1)} variant='outline'>
                    {t('common.retry')}
                  </Button>
                </div>
              ) : (
                <p className={summary && !summary.isSymlink
                  ? 'm-0 text-ui-body font-semibold tabular-nums text-foreground'
                  : 'm-0 text-ui-body text-muted-foreground'}>
                  {summaryText}
                </p>
              )}
              {summary && !summary.isSymlink ? (
                <p className='m-0 text-ui-caption text-muted-foreground'>
                  {t(summary.complete ? 'file_deletion.short_scope' : 'file_deletion.partial_hint')}
                </p>
              ) : null}
            </div>
          ) : null}
          {mode === 'permanent' && !summary?.isSymlink ? (
            <p className='m-0 text-ui-body font-medium text-destructive'>
              {t('file_deletion.permanent_warning')}
            </p>
          ) : null}
        </div>
      }
      actions={[
        { id: 'cancel', label: t('common.cancel'), autoFocus: true },
        {
          id: 'confirm',
          label: t(`file_deletion.${mode}_action`),
          danger: true,
          disabled: isFolder && summaryState.status !== 'ready',
        },
      ]}
    />
  )
}

export const FileDeletionConfirm = NiceModal.create(FileDeletionConfirmModal)
