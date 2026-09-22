import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { getFileObject } from '@/helper/files'
import useEditorStore from '@/stores/useEditorStore'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import type { TextFileFormat } from '@/components/EditorArea/textFileFormat'
import {
  applyEncodingPreview,
  previewFileEncoding,
  saveFileWithFormat,
  type EncodingPreview,
} from '@/services/text-file-format'
import { StatusBarButton } from './StatusBarButton'

const formats: { label: string; value: TextFileFormat }[] = [
  { label: 'UTF-8', value: { encoding: 'utf-8', bom: 'none' } },
  { label: 'UTF-8 with BOM', value: { encoding: 'utf-8', bom: 'utf8' } },
  { label: 'UTF-16 LE with BOM', value: { encoding: 'utf-16le', bom: 'utf16le' } },
  { label: 'UTF-16 BE with BOM', value: { encoding: 'utf-16be', bom: 'utf16be' } },
  { label: 'UTF-16 LE', value: { encoding: 'utf-16le', bom: 'none' } },
  { label: 'UTF-16 BE', value: { encoding: 'utf-16be', bom: 'none' } },
  { label: 'GBK', value: { encoding: 'gbk', bom: 'none' } },
  { label: 'GB18030', value: { encoding: 'gb18030', bom: 'none' } },
]
const formatKey = (format: TextFileFormat) => `${format.encoding}:${format.bom}`

function FileEncodingControl({ fileId }: { fileId: string }) {
  const text = useSyncExternalStore(fileSaveCoordinator.subscribe, () =>
    fileSaveCoordinator.getTextMetadata(fileId),
  )
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(formatKey(text.format))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<EncodingPreview>()
  const file = getFileObject(fileId)
  const format = formats.find((item) => formatKey(item.value) === selected)!.value
  const endings = Object.entries(text.lineEndings).filter(([, count]) => count > 0)
  const endingLabel = endings.length > 1 ? '混合换行' : (endings[0]?.[0].toUpperCase() ?? '无换行')
  const label =
    file?.path && !fileSaveCoordinator.getDiskRevision(fileId)
      ? '编码'
      : `${text.format.encoding.toUpperCase()}${text.format.bom !== 'none' ? ' BOM' : ''} · ${endingLabel}${text.decoding.needsConfirmation ? ' · 待确认' : ''}`
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
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        setOpen(next)
        if (next) {
          setSelected(formatKey(text.format))
          setPreview(undefined)
          setError('')
        }
      }}
    >
      <Dialog.Trigger asChild>
        <StatusBarButton aria-label='文本编码与换行' className='min-w-0 max-w-[40vw]' title={label}>
          <span className='truncate'>{label}</span>
        </StatusBarButton>
      </Dialog.Trigger>
      {open ? (
        <Dialog.Content closeLabel='关闭' size='lg'>
          <Dialog.Header>
            <Dialog.Title>文本编码与换行</Dialog.Title>
            <Dialog.Description>
              重新打开会按所选编码读取磁盘；以编码保存会转换当前文本。原有换行保持不变。
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Body className='flex flex-col gap-3'>
            <p>
              {file?.name} · {endingLabel}
            </p>
            {text.decoding.needsConfirmation ? (
              <p>当前编码由内容推测或来自旧草稿。请检查文字是否正确，再选择编码保存。</p>
            ) : null}
            {!text.decoding.byteRoundTrip ? (
              <p>文件含非标准字节映射，修改后需要显式转换到另一种编码。</p>
            ) : null}
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
              <Select.Trigger aria-label='文本编码'>
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
                <p>预览（前 4,000 个字符）。应用前会保留当前内容的恢复草稿。</p>
                <pre className='max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border bg-background p-3 text-foreground'>
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
              预览重新打开
            </Button>
            {preview ? (
              <Button
                variant='outline'
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await applyEncodingPreview(preview)
                    setOpen(false)
                  })
                }
              >
                应用重新打开
              </Button>
            ) : null}
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (await saveFileWithFormat(fileId, format)) setOpen(false)
                  else setError('尚未保存。内容和编码选择已保留，请检查保存提示后重试。')
                })
              }
            >
              以此编码保存
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      ) : null}
    </Dialog>
  )
}

export function TextEncodingButton() {
  const fileId = useEditorStore((state) => state.activeId)
  const file = fileId ? getFileObject(fileId) : undefined
  if (
    !fileId ||
    !file ||
    file.kind === 'new_tab' ||
    /^(pdf|png|jpe?g|gif|webp|ico|avif|bmp|mp[34]|wav|zip)$/i.test(file.ext ?? '')
  )
    return null
  return <FileEncodingControl key={fileId} fileId={fileId} />
}
