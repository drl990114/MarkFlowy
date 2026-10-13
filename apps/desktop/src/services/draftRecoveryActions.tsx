import { getFileObject } from '@/helper/files'
import { logger } from '@/helper/logger'
import { t } from '@/i18n'
import { toast } from 'zens'
import { dialog } from './dialog'
import {
  canKeepDraftRecovery,
  isDraftRecoveryPending,
  keepDraftRecoveryAndClose,
  pendingDraftRecoveryIds,
  waitForDraftRecovery,
} from './draftRecoveryState'

export function DraftRecoveryErrorDetails({ error }: { error: unknown }) {
  return (
    <details className='text-ui-caption text-muted-foreground'>
      <summary className='cursor-pointer'>{t('drafts.error_details')}</summary>
      <pre className='mt-2 whitespace-pre-wrap break-all'>{String(error)}</pre>
    </details>
  )
}

export async function keepFailedDraftAndClose(fileId: string) {
  try {
    await keepDraftRecoveryAndClose(fileId)
    return true
  } catch (error) {
    logger.error('Failed to retain draft before closing', error)
    toast.error(t('drafts.keep_failed'))
    return false
  }
}

/** Explicit recovery choices before closing tabs, a window or a workspace. */
export async function resolveDraftRecoveryBeforeClose(fileIds = pendingDraftRecoveryIds()) {
  for (;;) {
    const ids = [...new Set(fileIds)].filter(isDraftRecoveryPending)
    if (!ids.length) return true
    const results = await Promise.allSettled(ids.map((id) => waitForDraftRecovery(id)))
    const failed = ids.flatMap((id, index) => {
      const result = results[index]
      return result.status === 'rejected' && isDraftRecoveryPending(id)
        ? [{ id, error: result.reason as unknown }]
        : []
    })
    if (!failed.length) return true
    const canKeep = failed.every(({ id }) => canKeepDraftRecovery(id))
    const action = await dialog.confirm({
      title: t('drafts.restore_failed'),
      content: (
        <div className='space-y-3'>
          <p>{t('drafts.close_failed_description')}</p>
          {failed.map(({ id, error }) => (
            <div key={id}>
              <div className='text-ui-body'>{getFileObject(id)?.name}</div>
              <DraftRecoveryErrorDetails error={error} />
            </div>
          ))}
        </div>
      ),
      actions: [
        { id: 'retry', label: t('common.retry'), primary: true },
        ...(canKeep ? [{ id: 'keep', label: t('drafts.keep_and_close') }] : []),
        { id: 'cancel', label: t('common.cancel') },
      ],
    })
    if (action === 'retry') continue
    if (action !== 'keep' || !canKeep) return false
    for (const { id } of failed) {
      if (!await keepFailedDraftAndClose(id)) return false
    }
    return true
  }
}
