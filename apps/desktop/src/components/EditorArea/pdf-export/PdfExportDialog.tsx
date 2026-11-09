import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/ui/dialog'
import { RadioGroup } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/cn'
import type { PdfBrowserInfo, PdfExportEngine } from './pdfExport'
import { getPdfBrowserFailure } from './pdfBrowserDiagnostics'
import { PdfBrowserErrorDetails } from './PdfBrowserErrorDetails'

export interface PdfExportOptions {
  engine: PdfExportEngine
  paperSize: 'a4' | 'letter'
  landscape: boolean
  includeOutline: boolean
}

export interface PdfBrowserSettings {
  configuredPath: string
  busy: boolean
  error?: string
  onSelect: () => void
  onReset: () => void
  onCheck: () => void
}

export interface PdfExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (options: PdfExportOptions) => void
  onPrint: () => void
  onEngineChange?: (engine: PdfExportEngine) => void
  busy: boolean
  browserInfo?: PdfBrowserInfo
  checking: boolean
  browserCheckError?: string
  browserSettings: PdfBrowserSettings
  error?: string
}

export function PdfExportDialog({
  open,
  onOpenChange,
  onExport,
  onPrint,
  onEngineChange,
  busy,
  browserInfo,
  checking,
  browserCheckError,
  browserSettings,
  error,
}: PdfExportDialogProps) {
  const { t } = useTranslation()
  const id = useId()
  const [engine, setEngine] = useState<PdfExportEngine>('native')
  const [paperSize, setPaperSize] = useState<PdfExportOptions['paperSize']>('a4')
  const [landscape, setLandscape] = useState(false)
  const [includeOutline, setIncludeOutline] = useState(true)
  const ready = browserInfo?.available === true && browserInfo.compatible
  const usingBrowser = engine === 'browser'
  const browserPath = browserSettings.configuredPath || browserInfo?.executablePath
  const configuringBrowser = busy || browserSettings.busy
  const displayedError =
    error ?? (usingBrowser ? (browserSettings.error ?? browserCheckError) : undefined)
  const failure = getPdfBrowserFailure(browserInfo)
  const status = checking
    ? t('pdf_export.browser.checking')
    : ready
      ? t('pdf_export.browser.ready', { version: browserInfo.version ?? '' })
      : failure === 'invalid_executable'
        ? t('settings.export.pdf.status.invalid_executable')
        : failure === 'failed' || (!browserInfo && browserCheckError)
          ? t('pdf_export.browser_check_failed')
          : failure === 'incompatible'
            ? t('pdf_export.browser.incompatible')
            : t('pdf_export.browser.not_found')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content closeLabel={t('common.close')} size='lg'>
        <Dialog.Header>
          <Dialog.Title>{t('pdf_export.title')}</Dialog.Title>
          <Dialog.Description>{t('pdf_export.method_description')}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body className='flex flex-col gap-4'>
          <div className='flex flex-col gap-1.5'>
            <span id={`${id}-engine-label`} className='text-ui-control text-foreground'>
              {t('pdf_export.method')}
            </span>
            <RadioGroup
              aria-labelledby={`${id}-engine-label`}
              orientation='horizontal'
              className='grid grid-cols-2 gap-3'
              value={engine}
              onValueChange={(value) => {
                if (value === 'browser' || value === 'native') {
                  setEngine(value)
                  onEngineChange?.(value)
                }
              }}
              disabled={busy}
            >
              {(['native', 'browser'] as const).map((method) => (
                <label
                  key={method}
                  htmlFor={`${id}-engine-${method}`}
                  className={cn(
                    'flex min-w-0 cursor-pointer select-none items-start gap-2.5 rounded-lg border border-border bg-background p-3',
                    engine === method && 'border-primary bg-primary/5',
                    busy ? 'cursor-not-allowed opacity-50' : 'hover:border-primary/60',
                  )}
                >
                  <RadioGroup.Item
                    id={`${id}-engine-${method}`}
                    value={method}
                    aria-labelledby={`${id}-engine-${method}-title`}
                    aria-describedby={`${id}-engine-${method}-hint`}
                    className='mt-0.5'
                  />
                  <span className='flex min-w-0 flex-col gap-1.5'>
                    <span
                      id={`${id}-engine-${method}-title`}
                      className='text-ui-control font-medium text-foreground'
                    >
                      {t(`pdf_export.method_${method}`)}
                    </span>
                    <span
                      id={`${id}-engine-${method}-hint`}
                      className='text-ui-caption leading-relaxed text-muted-foreground'
                    >
                      {t(
                        method === 'browser'
                          ? 'pdf_export.description'
                          : 'pdf_export.native_hint',
                      )}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='flex min-w-0 flex-col gap-1.5'>
              <label
                htmlFor={`${id}-paper`}
                className='cursor-default select-none text-ui-control text-foreground'
              >
                {t('pdf_export.paper_size')}
              </label>
              <Select
                value={paperSize}
                onValueChange={(value) => {
                  if (value === 'a4' || value === 'letter') setPaperSize(value)
                }}
                disabled={busy}
              >
                <Select.Trigger id={`${id}-paper`}>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value='a4'>A4</Select.Item>
                  <Select.Item value='letter'>Letter</Select.Item>
                </Select.Content>
              </Select>
            </div>
            <div className='flex min-w-0 flex-col gap-1.5'>
              <label
                htmlFor={`${id}-orientation`}
                className='cursor-default select-none text-ui-control text-foreground'
              >
                {t('pdf_export.orientation')}
              </label>
              <Select
                value={landscape ? 'landscape' : 'portrait'}
                onValueChange={(value) => setLandscape(value === 'landscape')}
                disabled={busy}
              >
                <Select.Trigger id={`${id}-orientation`}>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value='portrait'>{t('pdf_export.portrait')}</Select.Item>
                  <Select.Item value='landscape'>{t('pdf_export.landscape')}</Select.Item>
                </Select.Content>
              </Select>
            </div>
          </div>
          <div className='flex items-start gap-2'>
            <Checkbox
              id={`${id}-outline`}
              checked={includeOutline}
              onCheckedChange={(value) => setIncludeOutline(value === true)}
              disabled={busy}
              aria-describedby={`${id}-outline-hint`}
              className='mt-0.5'
            />
            <div className='flex min-w-0 flex-col gap-1'>
              <label
                htmlFor={`${id}-outline`}
                className='cursor-default select-none text-ui-control text-foreground'
              >
                {t('pdf_export.include_outline')}
              </label>
              <p id={`${id}-outline-hint`} className='m-0 text-ui-caption text-muted-foreground'>
                {t('pdf_export.outline_hint')}
              </p>
            </div>
          </div>
          <div className='flex flex-col gap-1.5'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <p role='status' className='m-0 text-ui-control text-foreground'>
                {busy
                  ? t('pdf_export.exporting')
                  : usingBrowser
                    ? status
                    : t('pdf_export.native_ready')}
              </p>
              {usingBrowser ? (
                <div
                  role='group'
                  aria-label={t('settings.export.pdf.executable.label')}
                  className='flex flex-wrap items-center gap-1'
                >
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={configuringBrowser}
                    onClick={browserSettings.onSelect}
                  >
                    {t('settings.export.pdf.select')}
                  </Button>
                  {browserSettings.configuredPath ? (
                    <Button
                      size='sm'
                      variant='ghost'
                      disabled={configuringBrowser}
                      onClick={browserSettings.onReset}
                    >
                      {t('settings.export.pdf.automatic')}
                    </Button>
                  ) : null}
                  <Button
                    size='sm'
                    variant='ghost'
                    disabled={configuringBrowser || checking}
                    onClick={browserSettings.onCheck}
                  >
                    {t('settings.export.pdf.check_again')}
                  </Button>
                </div>
              ) : null}
            </div>
            {usingBrowser && browserPath ? (
              <p title={browserPath} className='m-0 truncate text-ui-caption text-muted-foreground'>
                {browserPath}
              </p>
            ) : null}
            {usingBrowser && !checking && !ready ? (
              <p className='m-0 text-ui-caption text-muted-foreground'>
                {t('pdf_export.browser.settings_hint')}
              </p>
            ) : null}
            <p className='m-0 text-ui-caption text-muted-foreground'>
              {t('pdf_export.system_print_hint')}
            </p>
          </div>
          {usingBrowser && !checking && !ready ? (
            <PdfBrowserErrorDetails info={browserInfo} />
          ) : null}
          {displayedError ? (
            <p role='alert' className='m-0 whitespace-pre-wrap text-ui-control text-destructive'>
              {displayedError}
            </p>
          ) : null}
        </Dialog.Body>
        <Dialog.Footer className='flex-wrap'>
          <Button variant='ghost' onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant='outline' onClick={onPrint} disabled={busy}>
            {t('pdf_export.system_print')}
          </Button>
          <Button
            disabled={busy || (usingBrowser && (checking || browserSettings.busy || !ready))}
            onClick={() =>
              onExport({
                engine,
                paperSize,
                landscape,
                includeOutline,
              })
            }
          >
            {t('pdf_export.export')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  )
}
