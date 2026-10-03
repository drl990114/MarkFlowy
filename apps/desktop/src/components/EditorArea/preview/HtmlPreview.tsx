import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslation } from '@/i18n'
import { PlayIcon, RefreshCwIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useEditorLoading } from '../EditorLoadingBoundary'
import {
  HTML_PREVIEW_SANDBOX,
  HTML_PREVIEW_TRUSTED_SANDBOX,
  prepareHtmlPreview,
  type PreparedHtmlPreview,
} from './htmlPreviewDocument'

export interface HtmlPreviewProps {
  content: string
  filePath?: string
  workspacePath?: string
}

export default function HtmlPreview({ content, filePath, workspacePath }: HtmlPreviewProps) {
  const { t } = useTranslation()
  const [revision, setRevision] = useState(0)
  const [scriptsEnabled, setScriptsEnabled] = useState(false)
  const generation = useRef(0)
  const [preview, setPreview] = useState<(PreparedHtmlPreview & { generation: number }) | null>(
    null,
  )
  const [error, setError] = useState(false)
  useEditorLoading(!preview && !error)
  useEffect(() => {
    const controller = new AbortController()
    let prepared: PreparedHtmlPreview | undefined
    setScriptsEnabled(false)
    setPreview(null)
    setError(false)
    void prepareHtmlPreview(content, filePath, controller.signal, undefined, { workspacePath })
      .then((result) => {
        prepared = result
        if (controller.signal.aborted) result.dispose()
        else setPreview({ ...result, generation: ++generation.current })
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => {
      controller.abort()
      prepared?.dispose()
    }
  }, [content, filePath, workspacePath, revision])

  return (
    <div
      className='absolute inset-0 flex flex-col overflow-hidden bg-background'
      data-slot='html-preview'
      aria-busy={!preview && !error}
    >
      <div className='box-border flex min-h-8 shrink-0 items-center justify-end gap-2 border-b border-border px-2'>
        {preview?.blockedResources ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button size='sm' variant='ghost' className='min-w-0 text-muted-foreground'>
                <span className='truncate' role='status'>
                  {t('document_preview.resources_blocked')} ({preview.blockedResources})
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align='end'
              className='w-80 max-w-[calc(100vw-2rem)]'
              aria-label={t('document_preview.resources_blocked')}
            >
              <ul className='m-0 max-h-64 list-none space-y-2 overflow-y-auto p-0 text-xs'>
                {preview.resourceIssues.map((issue) => (
                  <li key={`${issue.reason}:${issue.reference}`}>
                    <div className='break-all'>{issue.reference}</div>
                    <div className='text-muted-foreground'>
                      {t(`document_preview.resource_errors.${issue.reason}`)}
                    </div>
                  </li>
                ))}
              </ul>
              {preview.resourceIssues.some(
                ({ reason }) => reason === 'outside_root' || reason === 'permission_denied',
              ) ? (
                <p className='mb-0 mt-2 border-t border-border pt-2 text-xs text-muted-foreground'>
                  {t('document_preview.resource_folder_hint')}
                </p>
              ) : null}
            </PopoverContent>
          </Popover>
        ) : null}
        {!scriptsEnabled ? (
          <Button size='sm' variant='outline' onClick={() => setScriptsEnabled(true)}>
            <PlayIcon aria-hidden='true' className='size-3.5' />
            {t('document_preview.run_scripts')}
          </Button>
        ) : null}
        <Button
          size='sm'
          variant='ghost'
          onClick={() => setRevision((value) => value + 1)}
          aria-label={t('document_preview.refresh')}
        >
          <RefreshCwIcon aria-hidden='true' className='size-3.5' />
          {t('document_preview.refresh')}
        </Button>
      </div>
      {error ? (
        <div role='alert' className='mf-preview-error p-4 text-sm text-muted-foreground'>
          {t('document_preview.load_failed')}
        </div>
      ) : preview ? (
        <iframe
          key={`${preview.generation}:${scriptsEnabled}`}
          className='mf-preview-content min-h-0 w-full flex-1 border-0'
          title={t('document_preview.html_title')}
          sandbox={scriptsEnabled ? HTML_PREVIEW_TRUSTED_SANDBOX : HTML_PREVIEW_SANDBOX}
          referrerPolicy='no-referrer'
          srcDoc={preview.html}
        />
      ) : null}
    </div>
  )
}
