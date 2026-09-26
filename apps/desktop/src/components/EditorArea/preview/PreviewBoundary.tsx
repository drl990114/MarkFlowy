import { RenderErrorBoundary } from '@/components/RenderErrorBoundary'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/i18n'
import type { ReactNode } from 'react'
import { EditorLoadingSuspense } from '../EditorLoadingBoundary'

export function PreviewBoundary({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <RenderErrorBoundary
      fallback={({ reset }) => (
        <div className='p-4 text-sm text-muted-foreground' role='alert'>
          {t('document_preview.load_failed')}
          <Button variant='outline' size='sm' className='ml-2' onClick={reset}>
            {t('document_preview.retry')}
          </Button>
        </div>
      )}
    >
      <EditorLoadingSuspense>{children}</EditorLoadingSuspense>
    </RenderErrorBoundary>
  )
}
