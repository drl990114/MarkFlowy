import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/i18n'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Maximize2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import styles from 'virtual:mf-pdf-preview-style'
import { openPdfPreview, type PdfPreviewHandle, type PdfViewState } from './pdfPreviewRuntime'
import { registerPreviewSearch } from './previewSearch'

export interface PdfPreviewProps {
  fileId: string
  groupId?: string
  filePath?: string
  active: boolean
  visible: boolean
}

function ToolButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='size-6 shrink-0'
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export default function PdfPreview({
  fileId,
  groupId,
  filePath,
  active,
  visible,
}: PdfPreviewProps) {
  const { t } = useTranslation()
  const container = useRef<HTMLDivElement>(null)
  const pagesElement = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const handle = useRef<PdfPreviewHandle | null>(null)
  const savedView = useRef<{ path: string; view: PdfViewState } | null>(null)
  const abort = useRef<AbortController | null>(null)
  const [retry, setRetry] = useState(0)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [pages, setPages] = useState(0)
  const [scale, setScale] = useState(1)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState({ current: 0, total: 0 })
  const [password, setPassword] = useState('')
  const [passwordRequest, setPasswordRequest] = useState<{
    submit: (value: string) => void
    incorrect: boolean
  } | null>(null)

  useEffect(() => {
    if (!visible || !filePath || !container.current || !pagesElement.current) return
    const controller = new AbortController()
    abort.current = controller
    setReady(false)
    setFailed(false)
    setPasswordRequest(null)
    setPassword('')
    setMatches({ current: 0, total: 0 })
    void openPdfPreview(
      container.current,
      pagesElement.current,
      filePath,
      {
        onReady: (count) => {
          setPages(count)
          setReady(true)
          setPasswordRequest(null)
        },
        onPage: (value) => {
          setPage(value)
          setPageInput(String(value))
        },
        onScale: setScale,
        onMatches: (current, total) => setMatches({ current, total }),
        onPassword: (submit, incorrect) => {
          setPassword('')
          setPasswordRequest({ submit, incorrect })
        },
        onError: () => setFailed(true),
      },
      controller.signal,
      savedView.current?.path === filePath ? savedView.current.view : undefined,
    )
      .then((result) => {
        if (controller.signal.aborted) result.dispose()
        else handle.current = result
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => {
      if (handle.current) savedView.current = { path: filePath, view: handle.current.capture() }
      controller.abort()
      handle.current = null
    }
  }, [filePath, retry, visible])

  useEffect(() => {
    if (!active || !visible) return
    return registerPreviewSearch(fileId, groupId, () => {
      searchInput.current?.focus()
      searchInput.current?.select()
    })
  }, [active, visible, fileId, groupId])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => handle.current?.search(query), 200)
    return () => window.clearTimeout(timer)
  }, [query, ready])

  const jump = () => {
    if (!ready) return
    handle.current?.goToPage(Number(pageInput))
    setPageInput(String(handle.current?.capture().page ?? page))
  }
  const disabled = !ready || failed
  return (
    <div
      className='mf-pdf-preview absolute inset-0 flex min-h-0 flex-col bg-muted'
      data-slot='pdf-preview'
      aria-label={t('document_preview.pdf_title')}
      aria-busy={!ready && !failed && !passwordRequest}
    >
      <style>{styles}</style>
      <div
        className='box-border flex min-h-8 shrink-0 flex-wrap items-center gap-1 border-b border-border bg-background px-2 py-px text-foreground'
        role='group'
        aria-label={t('document_preview.pdf_title')}
      >
        <ToolButton
          label={t('document_preview.previous_page')}
          disabled={disabled || page <= 1}
          onClick={() => handle.current?.goToPage(page - 1)}
        >
          <ChevronLeftIcon aria-hidden='true' className='size-3.5' />
        </ToolButton>
        <Input
          aria-label={t('document_preview.page')}
          inputSize='sm'
          className='w-14 text-center tabular-nums'
          inputMode='numeric'
          value={pageInput}
          disabled={disabled}
          onChange={(event) => setPageInput(event.target.value)}
          onBlur={jump}
          onKeyDown={(event) => {
            if (event.key === 'Enter') jump()
          }}
        />
        <span className='text-xs tabular-nums'>/ {pages || '—'}</span>
        <ToolButton
          label={t('document_preview.next_page')}
          disabled={disabled || page >= pages}
          onClick={() => handle.current?.goToPage(page + 1)}
        >
          <ChevronRightIcon aria-hidden='true' className='size-3.5' />
        </ToolButton>
        <div aria-hidden='true' className='mx-1 h-4 w-px bg-border' />
        <ToolButton
          label={t('document_preview.zoom_out')}
          disabled={disabled || scale <= 0.25}
          onClick={() => handle.current?.zoomBy(1 / 1.25)}
        >
          <ZoomOutIcon aria-hidden='true' className='size-3.5' />
        </ToolButton>
        <span className='min-w-10 text-center text-xs tabular-nums'>
          {Math.round(scale * 100)}%
        </span>
        <ToolButton
          label={t('document_preview.zoom_in')}
          disabled={disabled || scale >= 5}
          onClick={() => handle.current?.zoomBy(1.25)}
        >
          <ZoomInIcon aria-hidden='true' className='size-3.5' />
        </ToolButton>
        <ToolButton
          label={t('document_preview.fit_width')}
          disabled={disabled}
          onClick={() => handle.current?.fitWidth()}
        >
          <Maximize2Icon aria-hidden='true' className='size-3.5' />
        </ToolButton>
        <Input
          ref={searchInput}
          aria-label={t('document_preview.search')}
          placeholder={t('document_preview.search')}
          inputSize='sm'
          className='ml-auto w-36'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              handle.current?.search(query, true, event.shiftKey)
            }
            if (event.key === 'Escape') {
              setQuery('')
              container.current?.focus()
            }
          }}
        />
        <span role='status' className='min-w-8 text-xs tabular-nums'>
          {query ? `${matches.current}/${matches.total}` : ''}
        </span>
        <ToolButton
          label={t('document_preview.previous_match')}
          disabled={disabled || !query}
          onClick={() => handle.current?.search(query, true, true)}
        >
          <ArrowUpIcon aria-hidden='true' className='size-3.5' />
        </ToolButton>
        <ToolButton
          label={t('document_preview.next_match')}
          disabled={disabled || !query}
          onClick={() => handle.current?.search(query, true)}
        >
          <ArrowDownIcon aria-hidden='true' className='size-3.5' />
        </ToolButton>
      </div>
      <div className='relative min-h-0 flex-1'>
        <div ref={container} className='absolute inset-0 overflow-auto' tabIndex={-1}>
          <div ref={pagesElement} className='pdfViewer' />
        </div>
        {passwordRequest ? (
          <form
            className='absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-6'
            onSubmit={(event) => {
              event.preventDefault()
              passwordRequest.submit(password)
              setPasswordRequest(null)
              setPassword('')
            }}
          >
            <label htmlFor={`pdf-password-${fileId}-${groupId}`}>
              {t(
                passwordRequest.incorrect
                  ? 'document_preview.password_incorrect'
                  : 'document_preview.password_required',
              )}
            </label>
            <Input
              autoFocus
              id={`pdf-password-${fileId}-${groupId}`}
              className='max-w-64'
              type='password'
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className='flex gap-2'>
              <Button type='submit'>{t('document_preview.unlock')}</Button>
              <Button
                variant='outline'
                onClick={() => {
                  abort.current?.abort()
                  setPasswordRequest(null)
                  setFailed(true)
                }}
              >
                {t('document_preview.cancel')}
              </Button>
            </div>
          </form>
        ) : failed || !filePath ? (
          <div
            className='absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-6 text-sm text-muted-foreground'
            role='alert'
          >
            {t('document_preview.load_failed')}
            <Button variant='outline' onClick={() => setRetry((value) => value + 1)}>
              {t('document_preview.retry')}
            </Button>
          </div>
        ) : !ready ? (
          <div
            role='status'
            className='pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground'
          >
            {t('document_preview.loading')}
          </div>
        ) : null}
      </div>
    </div>
  )
}
