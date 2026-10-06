import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { useTranslation } from '@/i18n'
import type { PdfBrowserInfo } from './pdfExport'

export interface PdfExportOptions {
  paperSize: 'a4' | 'letter'
  landscape: boolean
  includeOutline: boolean
}

export interface PdfExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (options: PdfExportOptions) => void
  onPrint: () => void
  busy: boolean
  browserInfo?: PdfBrowserInfo
  checking: boolean
  error?: string
}

export function PdfExportDialog({
  open,
  onOpenChange,
  onExport,
  onPrint,
  busy,
  browserInfo,
  checking,
  error,
}: PdfExportDialogProps) {
  const { t } = useTranslation()
  const id = useId()
  const [paperSize, setPaperSize] = useState<PdfExportOptions['paperSize']>('a4')
  const [landscape, setLandscape] = useState(false)
  const [includeOutline, setIncludeOutline] = useState(true)
  const ready = browserInfo?.available === true && browserInfo.compatible
  const status = checking
    ? t('pdf_export.browser.checking')
    : ready
      ? t('pdf_export.browser.ready', { version: browserInfo.version ?? '' })
      : browserInfo?.available
        ? t('pdf_export.browser.incompatible')
        : t('pdf_export.browser.not_found')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content closeLabel={t('common.close')} size='lg'>
        <Dialog.Header>
          <Dialog.Title>{t('pdf_export.title')}</Dialog.Title>
          <Dialog.Description>{t('pdf_export.description')}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body className='flex flex-col gap-4'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='flex min-w-0 flex-col gap-1.5'>
              <label htmlFor={`${id}-paper`} className='text-ui-control text-foreground'>
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
              <label htmlFor={`${id}-orientation`} className='text-ui-control text-foreground'>
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
              <label htmlFor={`${id}-outline`} className='text-ui-control text-foreground'>
                {t('pdf_export.include_outline')}
              </label>
              <p id={`${id}-outline-hint`} className='m-0 text-ui-caption text-muted-foreground'>
                {t('pdf_export.outline_hint')}
              </p>
            </div>
          </div>
          <div className='flex flex-col gap-1.5'>
            <p role='status' className='m-0 text-ui-control text-foreground'>
              {busy ? t('pdf_export.exporting') : status}
            </p>
            {!checking && !ready ? (
              <p className='m-0 text-ui-caption text-muted-foreground'>
                {t('pdf_export.browser.settings_hint')}
              </p>
            ) : null}
            <p className='m-0 text-ui-caption text-muted-foreground'>
              {t('pdf_export.system_print_hint')}
            </p>
          </div>
          {error ? (
            <p role='alert' className='m-0 whitespace-pre-wrap text-ui-control text-destructive'>
              {error}
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
            disabled={busy || checking || !ready}
            onClick={() => onExport({ paperSize, landscape, includeOutline })}
          >
            {t('pdf_export.export')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  )
}
