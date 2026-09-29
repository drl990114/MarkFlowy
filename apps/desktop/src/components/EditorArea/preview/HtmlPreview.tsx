import { Button } from '@/components/ui/button'
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
}

export default function HtmlPreview({ content, filePath }: HtmlPreviewProps) {
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
    void prepareHtmlPreview(content, filePath, controller.signal)
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
  }, [content, filePath, revision])

  return (
    <div
      className='absolute inset-0 flex flex-col overflow-hidden bg-background'
      data-slot='html-preview'
      aria-busy={!preview && !error}
    >
      <div className='box-border flex min-h-8 shrink-0 items-center justify-end gap-2 border-b border-border px-2'>
        {preview?.blockedResources ? (
          <span className='truncate text-xs text-muted-foreground' role='status'>
            {t('document_preview.resources_blocked')}
          </span>
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
