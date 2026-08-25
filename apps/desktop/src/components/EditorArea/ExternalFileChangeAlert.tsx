import { Button } from '@/components/ui/button'
import { useTranslation } from '@/i18n'
import useExternalFileChangeStore, {
  type ExternalFileChangeNotice,
} from '@/stores/useExternalFileChangeStore'
import { CheckIcon, CircleAlertIcon, LoaderCircleIcon } from 'lucide-react'
import { resolveExternalFileChange } from './externalFileChanges'

interface ExternalFileChangeAlertProps {
  fileId?: string
}

export function ExternalFileChangeAlert({ fileId }: ExternalFileChangeAlertProps) {
  const notice = useExternalFileChangeStore((state) =>
    fileId ? state.notices[fileId] : undefined,
  )

  if (!fileId || !notice) return null
  return <ExternalFileChangeAlertContent fileId={fileId} notice={notice} />
}

interface ExternalFileChangeAlertContentProps {
  fileId: string
  notice: ExternalFileChangeNotice
}

function ExternalFileChangeAlertContent({
  fileId,
  notice,
}: ExternalFileChangeAlertContentProps) {
  const { t } = useTranslation()

  if (notice.kind === 'updated') {
    return (
      <div
        aria-live='polite'
        className='flex min-h-8 shrink-0 items-center gap-2 border-t border-success/20 bg-success/[0.04] px-3 py-1.5 text-ui-caption text-content-secondary animate-[mf-fade-in_var(--mf-motion-duration-fast)_var(--mf-motion-ease-out)_both] motion-reduce:animate-none'
        role='status'
      >
        <CheckIcon aria-hidden='true' className='size-3.5 shrink-0 text-success' />
        <span>
          {t(
            notice.status === 'overwritten'
              ? 'external_file_change.overwritten'
              : 'external_file_change.reloaded',
          )}
        </span>
      </div>
    )
  }

  const resolving = Boolean(notice.resolving)

  return (
    <div
      aria-busy={resolving}
      className='flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-warning/30 bg-warning/[0.06] px-3 py-2 animate-[mf-fade-in_var(--mf-motion-duration-fast)_var(--mf-motion-ease-out)_both] motion-reduce:animate-none'
      role='alert'
    >
      <div className='flex min-w-0 flex-1 basis-48 items-start gap-2.5'>
        <CircleAlertIcon
          aria-hidden='true'
          className='mt-0.5 size-3.5 shrink-0 text-warning'
        />
        <div className='min-w-0'>
          <p className='m-0 text-ui-control font-medium leading-tight text-content-primary'>
            {t('external_file_change.conflict')}
          </p>
          <p className='m-0 mt-0.5 text-ui-caption leading-snug text-content-secondary'>
            {t('external_file_change.conflict_description')}
          </p>
        </div>
      </div>
      <div className='ml-auto flex shrink-0 items-center gap-1.5'>
        <Button
          disabled={resolving}
          size='sm'
          variant='secondary'
          onClick={() => void resolveExternalFileChange(fileId, 'reload')}
        >
          {notice.resolving === 'reload' ? (
            <LoaderCircleIcon
              aria-hidden='true'
              className='size-3.5 animate-spin motion-reduce:animate-none'
            />
          ) : null}
          {t('external_file_change.update')}
        </Button>
        <Button
          disabled={resolving}
          size='sm'
          variant='destructive'
          onClick={() => void resolveExternalFileChange(fileId, 'overwrite')}
        >
          {notice.resolving === 'overwrite' ? (
            <LoaderCircleIcon
              aria-hidden='true'
              className='size-3.5 animate-spin motion-reduce:animate-none'
            />
          ) : null}
          {t('external_file_change.overwrite')}
        </Button>
      </div>
    </div>
  )
}
