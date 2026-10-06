import { useTranslation } from '@/i18n'
import { flushDraftProtection, useHistoryProtection } from '@/services/local-history'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TriangleAlertIcon } from 'lucide-react'

export function DraftProtectionStatus({ fileId }: { fileId?: string }) {
  const failed = useHistoryProtection((s) => !!fileId && s.status[fileId] === 'failed')
  const paused = useHistoryProtection((s) => (fileId ? s.paused[fileId] : false))
  const { t } = useTranslation()
  if (!failed && !paused) return null
  if (!failed) {
    return (
      <span
        className='mx-2 truncate text-ui-caption text-muted-foreground'
        title={t('history.paused')}
      >
        {t('history.paused')}
      </span>
    )
  }
  const label = t('history.failed')
  const retryLabel = t('history.retry')
  return (
    <>
      <span className='sr-only' role='status'>
        {label}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={`${label} · ${retryLabel}`}
            data-mf-chrome-icon-button=''
            variant='chrome'
            size='icon-chrome'
            onClick={() => {
              void flushDraftProtection(fileId).catch(() => undefined)
            }}
          >
            <TriangleAlertIcon
              aria-hidden='true'
              className='text-warning'
              size={14}
              strokeWidth={1.75}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent className='max-w-64 text-center'>
          <div>{label}</div>
          <div className='text-muted-foreground'>{retryLabel}</div>
        </TooltipContent>
      </Tooltip>
    </>
  )
}
