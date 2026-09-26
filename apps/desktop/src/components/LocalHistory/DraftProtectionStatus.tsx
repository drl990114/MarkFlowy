import { useTranslation } from '@/i18n'
import { flushDraftProtection, useHistoryProtection } from '@/services/local-history'
import { Button } from '@/components/ui/button'

export function DraftProtectionStatus({ fileId }: { fileId?: string }) {
  const state = useHistoryProtection((s) => (fileId ? s.status[fileId] : undefined))
  const paused = useHistoryProtection((s) => (fileId ? s.paused[fileId] : false))
  const { t } = useTranslation()
  if (state !== 'failed' && !paused) return null
  const label = t(state === 'failed' ? 'history.failed' : 'history.paused')
  return (
    <span
      className='mx-2 flex items-center gap-1 truncate text-ui-caption text-muted-foreground'
      title={label}
      role={state === 'failed' ? 'alert' : undefined}
    >
      {label}
      {state === 'failed' ? (
        <Button
          variant='ghost'
          size='sm'
          onClick={() => {
            void flushDraftProtection(fileId).catch(() => undefined)
          }}
        >
          {t('history.retry')}
        </Button>
      ) : null}
    </span>
  )
}
