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
  const [loading, setLoading] = useState(false)
  const [listing, setListing] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [offset, setOffset] = useState(0)
  const [comparison, setComparison] = useState('batch')
  const [choices, setChoices] = useState<HistoryEntry[]>([])
  const [largeDiff, setLargeDiff] = useState(false)
  const selectionToken = useRef(0)
  const restoreOperation = useRef(0)
  const [loadedRevision, setLoadedRevision] = useState(revision)
  const busy = loading || restoring

  useEffect(() => {
    const token = selectionToken
    const restoreToken = restoreOperation
    token.current++
    restoreToken.current++
    setOffset(0)
    setEntries([])
    setSelected(undefined)
    setPair(undefined)
    setChoices([])
    setError('')
    setLoading(false)
    setRestoring(false)
    setLargeDiff(false)
    return () => {
      token.current++
      restoreToken.current++
    }
  }, [open, fileId])

  useEffect(() => {
    if (!open) return
    let disposed = false
    setListing(true)
    void (async () => {
      const document = fileId ? await historyDocument(fileId) : undefined
      const rows = await historyCall<HistoryEntry[]>('list', {
        workspace: fileId ? undefined : historyWorkspace(),
        documentId: document?.id,
        offset,
      })
      if (!disposed) setEntries(rows)
    })()
      .catch((e) => {
        if (!disposed) setError(String(e))
      })
      .finally(() => {
        if (!disposed) setListing(false)
      })
    return () => {
      disposed = true
    }
  }, [open, fileId, revision, offset])

  useEffect(() => {
    if (!open || !selected) return
    let disposed = false
    const token = selectionToken.current
    void historyCall<boolean>('exists', { entryId: selected.id })
      .then((exists) => {
        if (!exists) throw new Error('history_invalidated')
      })
      .catch(() => {
        if (!disposed && token === selectionToken.current) {
          selectionToken.current++
          setSelected(undefined)
          setPair(undefined)
          setLoading(false)
        }
      })
    return () => {
      disposed = true
    }
  }, [open, fileId, revision, selected])

  const isCurrent = (token: number) => {
    const dialog = useHistoryDialog.getState()
    return token === selectionToken.current && dialog.open && dialog.fileId === fileId
  }
  const select = async (entry: HistoryEntry, compare = comparison) => {
    const token = ++selectionToken.current
    setSelected(entry)
    setComparison(compare)
    setPair(undefined)
    setLargeDiff(false)
    setLoading(true)
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
      if (!isCurrent(token)) return
      const rows = await historyCall<HistoryEntry[]>('list', { documentId: entry.documentId })
      if (!isCurrent(token)) return
      setComparison(compare)
      setChoices(rows)
      setPair({ before: a.content, after: b.content })
      setLoadedRevision(revision)
    } catch (e) {
      if (isCurrent(token)) setError(String(e))
    } finally {
      if (isCurrent(token)) setLoading(false)
    }
  }
  const restore = async (before: boolean) => {
    if (!selected || !pair || busy) return
    const token = selectionToken.current
    const operation = ++restoreOperation.current
    setRestoring(true)
    setError('')
    try {
      await restoreHistory(selected.id, before)
      if (isCurrent(token)) useHistoryDialog.setState({ open: false })
    } catch (e) {
      if (isCurrent(token)) setError(String(e))
    } finally {
      if (operation === restoreOperation.current) setRestoring(false)
    }
  }
  const comparedEntry = choices.find((entry) => entry.id === comparison)
  const labels = {
    beforeLabel:
      comparison === 'batch'
        ? t('history.before')
        : comparison === 'current'
          ? t('history.snapshot')
          : selected && new Date(selected.updatedAt).toLocaleString(),
    afterLabel:
      comparison === 'batch'
        ? t('history.after')
        : comparison === 'current'
          ? t('history.current')
          : comparedEntry && new Date(comparedEntry.updatedAt).toLocaleString(),
  }

  return (
    <Dialog open={open} onOpenChange={(next) => useHistoryDialog.setState({ open: next })}>
      <Dialog.Content size='full' className='h-[85vh] gap-0 p-0' closeLabel={t('common.close')}>
        <Dialog.Header className='min-h-12 justify-center border-b border-border px-4 py-3 pr-12'>
          <Dialog.Title className='text-ui-control font-medium'>{t('history.title')}</Dialog.Title>
          <Dialog.Description className='sr-only'>{t('history.description')}</Dialog.Description>
        </Dialog.Header>
        {error ? (
          <p
            role='alert'
            className='border-b border-border px-3 py-2 text-ui-control text-destructive'
          >
            {error}
          </p>
        ) : null}
        <div className='flex min-h-0 flex-1 text-ui-control'>
          <div className='flex w-56 min-w-0 max-w-[35%] shrink-0 flex-col border-r border-border bg-surface-app'>
            <div className='flex h-10 shrink-0 items-center px-3 text-ui-caption font-medium text-muted-foreground'>
              {t('history.versions')}
            </div>
            <div className='min-h-0 flex-1 overflow-auto p-1'>
              {entries.length === 0 ? (
                <p
                  role={listing ? 'status' : undefined}
                  className='px-2 py-3 text-muted-foreground'
                >
                  {t(listing ? 'history.loading' : 'history.empty')}
                </p>
              ) : (
                entries.map((entry) => (
                  <Button
                    key={entry.id}
                    data-mf-history-entry-id={entry.id}
                    variant={selected?.id === entry.id ? 'secondary' : 'ghost'}
                    aria-pressed={selected?.id === entry.id}
                    className='h-auto min-h-12 w-full justify-start whitespace-normal rounded-sm px-2 py-2 text-left'
                    disabled={restoring}
                    onClick={() => void select(entry, fileId ? 'current' : 'batch')}
                  >
                    <span className='min-w-0'>
                      <strong className='block truncate font-medium'>
                        {entry.message || entry.name}
                      </strong>
                      <span className='mt-0.5 block text-ui-caption text-muted-foreground tabular-nums'>
                        {new Date(entry.updatedAt).toLocaleString()} ·{' '}
                        {entry.active
                          ? t('history.merging')
                          : t(`history.kind_${entry.kind}`, { defaultValue: entry.kind })}
                      </span>
                    </span>
                  </Button>
                ))
              )}
            </div>
            <div className='flex shrink-0 items-center justify-between gap-1 border-t border-border px-1 py-2'>
              <Button
                variant='ghost'
                size='sm'
                disabled={!offset || listing || restoring}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                {t('history.previous')}
              </Button>
              <Button
                variant='ghost'
                size='sm'
                disabled={entries.length < 50 || listing || restoring}
                onClick={() => setOffset(offset + 50)}
              >
                {t('history.next')}
              </Button>
            </div>
          </div>
          <div className='flex min-w-0 flex-1 flex-col bg-background' aria-busy={loading}>
            {selected ? (
              <div className='flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5'>
                <span
                  className='min-w-0 flex-1 truncate font-medium'
                  title={selected.message || selected.name}
                >
                  {selected.message || selected.name}
                </span>
                <Select
                  value={comparison}
                  onValueChange={(value) => void select(selected, value)}
                  disabled={busy}
                >
                  <Select.Trigger
                    aria-label={t('history.compare_version')}
                    size='sm'
                    className='w-auto max-w-full sm:max-w-64'
                  >
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
                {pair && revision !== loadedRevision ? (
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={busy}
                    onClick={() => void select(selected)}
                  >
                    {t('history.refresh')}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {loading ? (
              <p role='status' className='m-auto p-4 text-ui-caption text-muted-foreground'>
                {t('history.loading')}
              </p>
            ) : pair ? (
              Math.max(pair.before.length, pair.after.length) > 2 * 1024 * 1024 && !largeDiff ? (
                <>
                  <div className='border-b border-border px-3 py-2'>
                    <Button variant='outline' size='sm' onClick={() => setLargeDiff(true)}>
                      {t('history.compute_large')}
                    </Button>
                  </div>
                  <HistorySnapshotTexts {...pair} {...labels} />
                </>
              ) : (
                <HistoryDiffPreview key={`${selected?.id}:${comparison}`} {...pair} {...labels} />
              )
            ) : (
              <p className='m-auto p-4 text-muted-foreground'>{t('history.select')}</p>
            )}
          </div>
        </div>
        <Dialog.Footer className='mt-0 border-t border-border px-3 py-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={busy || !pair || !selected?.beforeHash}
            onClick={() => void restore(true)}
          >
            {t('history.restore_before')}
          </Button>
          <Button
            size='sm'
            disabled={busy || !pair || !selected}
            onClick={() => void restore(false)}
          >
            {t('history.restore')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  )
}
