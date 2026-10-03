import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { getFileObject } from '@/helper/files'
import { useTranslation } from '@/i18n'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import type { TextFileFormat } from '@/components/EditorArea/textFileFormat'
import {
  applyEncodingPreview,
  previewFileEncoding,
  saveFileWithFormat,
  type EncodingPreview,
} from '@/services/text-file-format'

const formats: { label: string; value: TextFileFormat }[] = [
  { label: 'UTF-8', value: { encoding: 'utf-8', bom: 'none' } },
  { label: 'UTF-8 BOM', value: { encoding: 'utf-8', bom: 'utf8' } },
  { label: 'UTF-16 LE BOM', value: { encoding: 'utf-16le', bom: 'utf16le' } },
  { label: 'UTF-16 BE BOM', value: { encoding: 'utf-16be', bom: 'utf16be' } },
  { label: 'UTF-16 LE', value: { encoding: 'utf-16le', bom: 'none' } },
  { label: 'UTF-16 BE', value: { encoding: 'utf-16be', bom: 'none' } },
  { label: 'GBK', value: { encoding: 'gbk', bom: 'none' } },
  { label: 'GB18030', value: { encoding: 'gb18030', bom: 'none' } },
]
const formatKey = (format: TextFileFormat) => `${format.encoding}:${format.bom}`

export interface TextEncodingDialogProps {
  fileId: string
  onClose: () => void
}

export function TextEncodingDialog({ fileId, onClose }: TextEncodingDialogProps) {
  const { t } = useTranslation()
  const text = useSyncExternalStore(fileSaveCoordinator.subscribe, () =>
    fileSaveCoordinator.getTextMetadata(fileId),
  )
  const [selected, setSelected] = useState(formatKey(text.format))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<EncodingPreview>()
  const file = getFileObject(fileId)
  const format = formats.find((item) => formatKey(item.value) === selected)!.value
  const endings = Object.entries(text.lineEndings).filter(([, count]) => count > 0)
  const endingLabel =
    endings.length > 1
      ? t('text_encoding.mixed_endings')
      : (endings[0]?.[0].toUpperCase() ?? t('text_encoding.no_endings'))
  const label =
    file?.path && !fileSaveCoordinator.getDiskRevision(fileId)
      ? t('text_encoding.encoding')
      : `${text.format.encoding.toUpperCase()}${text.format.bom !== 'none' ? ' BOM' : ''} · ${endingLabel}${text.decoding.needsConfirmation ? ` · ${t('text_encoding.unconfirmed')}` : ''}`
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (failure) {
      setError(String(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onClose()
      }}
    >
      <Dialog.Content closeLabel={t('common.close')} size='lg'>
        <Dialog.Header>
          <Dialog.Title>{t('text_encoding.label')}</Dialog.Title>
          <Dialog.Description>{t('text_encoding.description')}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body className='flex flex-col gap-3'>
          <p>
            {file?.name} · {label}
          </p>
          {text.decoding.needsConfirmation ? <p>{t('text_encoding.confirm_hint')}</p> : null}
          {!text.decoding.byteRoundTrip ? <p>{t('text_encoding.roundtrip_hint')}</p> : null}
          {text.saveError ? (
            <p role='alert' className='whitespace-pre-wrap text-destructive'>
              {text.saveError}
            </p>
          ) : null}
          <Select
            value={selected}
            onValueChange={(value) => {
              setSelected(value)
              setPreview(undefined)
            }}
            disabled={busy}
          >
            <Select.Trigger aria-label={t('text_encoding.encoding')} size='sm'>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {formats.map((item) => (
                <Select.Item key={formatKey(item.value)} value={formatKey(item.value)}>
                  {item.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          {preview ? (
            <>
              <p>{t('text_encoding.preview_hint')}</p>
              <pre className='max-h-64 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-background p-2 font-mono text-[length:var(--mf-theme-font-source-size,15px)] leading-[var(--mf-theme-font-source-line-height,1.6)] text-foreground'>
                {preview.snapshot.content.slice(0, 4000)}
              </pre>
            </>
          ) : null}
          {error ? (
            <p role='alert' className='whitespace-pre-wrap text-destructive'>
              {error}
            </p>
          ) : null}
        </Dialog.Body>
        <Dialog.Footer>
          <Button
            variant='outline'
            disabled={busy || !file?.path}
            onClick={() =>
              void run(async () => {
                setPreview(await previewFileEncoding(fileId, format.encoding))
              })
            }
          >
            {t('text_encoding.preview_reopen')}
          </Button>
          {preview ? (
            <Button
              variant='outline'
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await applyEncodingPreview(preview)
                  onClose()
                })
              }
            >
              {t('text_encoding.apply_reopen')}
            </Button>
          ) : null}
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (await saveFileWithFormat(fileId, format)) onClose()
                else setError(t('text_encoding.save_failed'))
              })
            }
          >
            {t('text_encoding.save_with_encoding')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  )
}
