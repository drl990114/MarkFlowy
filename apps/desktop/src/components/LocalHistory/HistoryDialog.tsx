import { Select } from '@/components/ui/select'
import { getFileObjectByPath } from '@/helper/files'
import useEditorStore from '@/stores/useEditorStore'
import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/i18n'
import {
  historyCall,
  historyDocument,
  historyWorkspace,
  useHistoryProtection,
  type HistoryEntry,
  type HistoryDocument,
} from '@/services/local-history'
import { restoreHistory } from '@/services/restore-history'
import { useHistoryDialog } from './historyDialogStore'
import { HistoryDiffPreview, HistorySnapshotTexts } from './HistoryDiffPreview'

export default function HistoryDialog() {
  const { open, fileId } = useHistoryDialog()
  const revision = useHistoryProtection((s) => s.revision)
  const { t } = useTranslation()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [selected, setSelected] = useState<HistoryEntry>()
  const [pair, setPair] = useState<{ before: string; after: string }>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [offset, setOffset] = useState(0)
  const [comparison, setComparison] = useState('batch')
  const [choices, setChoices] = useState<HistoryEntry[]>([])
  const [largeDiff, setLargeDiff] = useState(false)
  const selectionToken = useRef(0)
  useEffect(
    () => () => {
      selectionToken.current++
    },
    [],
  )
  const [loadedRevision, setLoadedRevision] = useState(revision)
  useEffect(() => {
    setOffset(0)
    setSelected(undefined)
    setPair(undefined)
  }, [open, fileId])
  useEffect(() => {
    if (!open) return
    let disposed = false
    void (async () => {
      const document = fileId ? await historyDocument(fileId) : undefined
      const rows = await historyCall<HistoryEntry[]>('list', {
        workspace: fileId ? undefined : historyWorkspace(),
        documentId: document?.id,
        offset,
      })
      if (!disposed) {
        setEntries(rows)
        setError('')
      }
      if (selected) {
        try {
          if (!(await historyCall<boolean>('exists', { entryId: selected.id })))
            throw new Error('history_invalidated')
        } catch {
          if (!disposed) {
            selectionToken.current++
            setSelected(undefined)
            setPair(undefined)
          }
        }
      }
    })().catch((e) => {
      if (!disposed) setError(String(e))
    })
    return () => {
      disposed = true
    }
  }, [open, fileId, revision, offset, selected])
  const select = async (entry: HistoryEntry, compare = comparison) => {
    const token = ++selectionToken.current
    setLargeDiff(false)
    setBusy(true)
    setError('')
    try {
      const read = (before: boolean) =>
        historyCall<{ document: HistoryDocument; content: string }>('read', {
          entryId: entry.id,
          before,
        })
      let a: { content: string }
      let b: { content: string }
      const currentId = fileId ?? (entry.path ? getFileObjectByPath(entry.path)?.id : undefined)
      if (
        compare === 'current' &&
        currentId &&
        useEditorStore.getState().opened.includes(currentId)
      ) {
        a = await read(false)
        b = { content: useEditorStore.getState().getEditorContent(currentId) }
      } else if (compare !== 'batch' && compare !== 'current') {
        ;[a, b] = await Promise.all([
          read(false),
          historyCall<{ content: string }>('read', { entryId: compare }),
        ])
      } else {
        ;[a, b] = await Promise.all([
          entry.beforeHash ? read(true) : Promise.resolve({ content: '' }),
          read(false),
        ])
        compare = 'batch'
      }
      const rows = await historyCall<HistoryEntry[]>('list', { documentId: entry.documentId })
      if (token !== selectionToken.current) return
      setComparison(compare)
      setChoices(rows)
      setSelected(entry)
      setPair({ before: a.content, after: b.content })
      setLoadedRevision(revision)
    } catch (e) {
      if (token === selectionToken.current) setError(String(e))
    } finally {
      if (token === selectionToken.current) setBusy(false)
    }
  }
  const restore = async (before: boolean) => {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await restoreHistory(selected.id, before)
      useHistoryDialog.setState({ open: false })
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(next) => useHistoryDialog.setState({ open: next })}>
      <Dialog.Content size='full' className='h-[80vh] flex flex-col' closeLabel={t('common.close')}>
        <Dialog.Header>
          <Dialog.Title>{t('history.title')}</Dialog.Title>
          <Dialog.Description>{t('history.description')}</Dialog.Description>
        </Dialog.Header>
        {error ? (
          <p role='alert' className='text-ui-control text-destructive'>
            {error}
          </p>
        ) : null}
        <div className='flex min-h-0 flex-1 gap-3 text-ui-control'>
          <div className='flex w-56 min-w-0 max-w-[40%] shrink-0 flex-col gap-1 overflow-auto border-r border-border pr-2'>
            {entries.length === 0 ? (
              <p className='text-muted-foreground'>{t('history.empty')}</p>
            ) : (
              entries.map((entry) => (
                <Button
                  key={entry.id}
                  variant={selected?.id === entry.id ? 'secondary' : 'ghost'}
                  aria-pressed={selected?.id === entry.id}
                  className='h-auto min-h-10 justify-start whitespace-normal rounded-sm px-2 py-1.5 text-left'
                  disabled={busy}
                  onClick={() => void select(entry, fileId ? 'current' : 'batch')}
                >
                  <span className='min-w-0'>
                    <strong className='block truncate font-medium'>{entry.message || entry.name}</strong>
                    <span className='block text-ui-caption text-muted-foreground tabular-nums'>
                      {new Date(entry.updatedAt).toLocaleString()} ·{' '}
                      {entry.active
                        ? t('history.merging')
                        : t(`history.kind_${entry.kind}`, { defaultValue: entry.kind })}
                    </span>
                  </span>
                </Button>
              ))
            )}
            <div className='mt-1 flex flex-wrap gap-1'>
              <Button
                variant='ghost'
                size='sm'
                disabled={!offset || busy}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                {t('history.previous')}
              </Button>
              <Button
                variant='ghost'
                size='sm'
                disabled={entries.length < 50 || busy}
                onClick={() => setOffset(offset + 50)}
              >
                {t('history.next')}
              </Button>
            </div>
          </div>
          <div className='flex min-w-0 flex-1 flex-col gap-2'>
            {selected ? (
              <Select
                value={comparison}
                onValueChange={(value) => void select(selected, value)}
                disabled={busy}
              >
                <Select.Trigger aria-label={t('history.compare_version')} size='sm'>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value='batch'>{t('history.compare_batch')}</Select.Item>
                  {fileId ? (
                    <Select.Item value='current'>{t('history.compare_current')}</Select.Item>
                  ) : null}
                  {choices
                    .filter((entry) => entry.id !== selected.id)
                    .map((entry) => (
                      <Select.Item key={entry.id} value={entry.id}>
                        {entry.message || new Date(entry.updatedAt).toLocaleString()}
                      </Select.Item>
                    ))}
                </Select.Content>
              </Select>
            ) : null}
            <div className='flex justify-between text-ui-caption text-muted-foreground'>
              <span>{t('history.before')}</span>
              <span>{t('history.after')}</span>
            </div>
            {selected && revision !== loadedRevision ? (
              <Button variant='outline' size='sm' onClick={() => void select(selected)}>
                {t('history.refresh')}
              </Button>
            ) : null}
            {pair ? (
              Math.max(pair.before.length, pair.after.length) > 2 * 1024 * 1024 && !largeDiff ? (
                <>
                  <Button variant='outline' size='sm' onClick={() => setLargeDiff(true)}>
                    {t('history.compute_large')}
                  </Button>
                  <HistorySnapshotTexts {...pair} />
                </>
              ) : (
                <HistoryDiffPreview key={`${selected?.id}:${comparison}`} {...pair} />
              )
            ) : (
              <p className='text-muted-foreground'>{t('history.select')}</p>
            )}
          </div>
        </div>
        <Dialog.Footer>
          <Button
            variant='outline'
            disabled={busy || !selected?.beforeHash}
            onClick={() => void restore(true)}
          >
            {t('history.restore_before')}
          </Button>
          <Button disabled={busy || !selected} onClick={() => void restore(false)}>
            {t('history.restore')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  )
}
