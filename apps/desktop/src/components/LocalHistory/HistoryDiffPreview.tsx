import { RenderErrorBoundary } from '@/components/RenderErrorBoundary'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from '@/i18n'
import { lazy, Suspense, useState } from 'react'
import { loadHistoryDiff } from './historyDiffLoader'

export interface HistoryComparisonProps {
  before: string
  after: string
}

export function HistorySnapshotTexts({ before, after }: HistoryComparisonProps) {
  const { t } = useTranslation()
  return (
    <div className='grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-auto'>
      <Textarea
        readOnly
        aria-label={t('history.before')}
        value={before}
        className='h-full min-h-0 resize-none font-mono'
      />
      <Textarea
        readOnly
        aria-label={t('history.after')}
        value={after}
        className='h-full min-h-0 resize-none font-mono'
      />
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
          <div role='alert' className='flex items-center gap-2 text-sm text-muted-foreground'>
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
      <Suspense fallback={<p role='status'>{t('history.loading')}</p>}>
        <HistoryDiff {...props} />
      </Suspense>
    </RenderErrorBoundary>
  )
}
