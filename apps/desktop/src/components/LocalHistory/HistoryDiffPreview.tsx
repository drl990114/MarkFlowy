import { RenderErrorBoundary } from '@/components/RenderErrorBoundary'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from '@/i18n'
import { lazy, Suspense, useState } from 'react'
import { loadHistoryDiff } from './historyDiffLoader'

export interface HistoryComparisonProps {
  before: string
  after: string
  beforeLabel?: string
  afterLabel?: string
}

export function HistorySnapshotTexts({
  before,
  after,
  beforeLabel,
  afterLabel,
}: HistoryComparisonProps) {
  const { t } = useTranslation()
  return (
    <div className='grid min-h-0 flex-1 grid-cols-2 overflow-hidden bg-background'>
      <div className='flex min-h-0 min-w-0 flex-col border-r border-border'>
        <div className='truncate border-b border-border px-3 py-2 text-ui-caption text-muted-foreground'>
          {beforeLabel ?? t('history.before')}
        </div>
        <Textarea
          readOnly
          aria-label={beforeLabel ?? t('history.before')}
          value={before}
          className='h-full min-h-0 resize-none rounded-none border-0 font-mono text-[length:var(--mf-theme-font-source-size,15px)] leading-[var(--mf-theme-font-source-line-height,1.6)]'
          style={{ fontFamily: 'var(--mf-theme-font-code-family, monospace)' }}
        />
      </div>
      <div className='flex min-h-0 min-w-0 flex-col'>
        <div className='truncate border-b border-border px-3 py-2 text-ui-caption text-muted-foreground'>
          {afterLabel ?? t('history.after')}
        </div>
        <Textarea
          readOnly
          aria-label={afterLabel ?? t('history.after')}
          value={after}
          className='h-full min-h-0 resize-none rounded-none border-0 font-mono text-[length:var(--mf-theme-font-source-size,15px)] leading-[var(--mf-theme-font-source-line-height,1.6)]'
          style={{ fontFamily: 'var(--mf-theme-font-code-family, monospace)' }}
        />
      </div>
    </div>
  )
}

export function HistoryDiffPreview(props: HistoryComparisonProps) {
  const { t } = useTranslation()
  const [HistoryDiff, setHistoryDiff] = useState(() => lazy(loadHistoryDiff))

  return (
    <RenderErrorBoundary
      resetKey={HistoryDiff}
      fallback={() => (
        <>
          <div
            role='alert'
            className='flex flex-wrap items-center gap-2 px-3 py-2 text-ui-control text-muted-foreground'
          >
            <span>{t('history.compare_failed')}</span>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                // React.lazy caches rejected imports. Retry with a fresh lazy
                // component instead of resetting to the same rejected promise.
                setHistoryDiff(() => lazy(loadHistoryDiff))
              }}
            >
              {t('common.retry')}
            </Button>
          </div>
          <HistorySnapshotTexts {...props} />
        </>
      )}
    >
      <Suspense
        fallback={
          <p role='status' className='p-3 text-ui-caption text-muted-foreground'>
            {t('history.loading')}
          </p>
        }
      >
        <HistoryDiff {...props} />
      </Suspense>
    </RenderErrorBoundary>
  )
}
