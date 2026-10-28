import { ChevronRight } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { PdfBrowserInfo } from './pdfExport'

export function PdfBrowserErrorDetails({ info }: { info?: PdfBrowserInfo }) {
  const { t } = useTranslation()
  const error = info?.error
  if (!info || !error || error.code === 'not_found' || info.compatible) return null

  const details = [`[${error.code}] ${error.message}`, info.executablePath, error.detail]
    .filter(Boolean)
    .join('\n\n')

  return (
    <details className='group w-full min-w-0 text-left'>
      <summary className='flex cursor-default select-none list-none items-center gap-2 rounded-sm py-1 text-ui-caption text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden'>
        <ChevronRight aria-hidden className='size-3.5 shrink-0 group-open:rotate-90' />
        {t('pdf_export.browser.error_details')}
      </summary>
      <pre
        className='m-0 mt-1 max-h-40 max-w-full select-text overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-background p-3 font-mono text-ui-caption leading-relaxed text-foreground'
        dir='auto'
      >
        {details}
      </pre>
    </details>
  )
}
