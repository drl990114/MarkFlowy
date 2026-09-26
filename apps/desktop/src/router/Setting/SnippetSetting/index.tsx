import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { getBuiltinSnippets } from '@/features/snippets/builtins'
import {
  loadSnippets,
  mutateSnippet,
  useSnippetLibrary,
  useSnippetStore,
} from '@/features/snippets/store'
import {
  validSnippet,
  type CapricornSnippet,
  type CapricornSnippetKind,
} from '@/features/snippets/types'
import { useTranslation } from '@/i18n'
import { dialog } from '@/services/dialog'
import { cn } from '@/lib/cn'
import type { RegisterSettingLeaveGuard } from '../types'

const SnippetPreview = lazy(() => import('./SnippetPreview'))
const kinds: CapricornSnippetKind[] = ['math', 'mermaid', 'code']
const fingerprint = (item: CapricornSnippet) => JSON.stringify(item)
const userId = () => `user:${crypto.randomUUID()}`

interface Draft {
  item: CapricornSnippet
  baseline: string
  revision: number
}

export function SnippetSetting({
  initialKind = 'math',
  navigationId,
  registerLeaveGuard,
}: {
  initialKind?: CapricornSnippetKind
  navigationId?: number
  registerLeaveGuard: RegisterSettingLeaveGuard
}) {
  const { t } = useTranslation()
  const { library, loaded, error: loadError } = useSnippetLibrary()
  const builtinItems = useMemo(() => getBuiltinSnippets((key) => t(key)), [t])
  const [kind, setKind] = useState(initialKind)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Draft>(() => {
    const item = builtinItems.find((candidate) => candidate.kind === initialKind)!
    return { item, baseline: fingerprint(item), revision: library.revision }
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ item: CapricornSnippet; id: number }>()
  const pendingGuard = useRef<Promise<boolean> | null>(null)
  const fieldsId = useId()
  const dirty = fingerprint(draft.item) !== draft.baseline
  const builtin = draft.item.id.startsWith('builtin:')
  const hidden = library.hiddenBuiltinIds.includes(draft.item.id)
  const allItems = useMemo(() => [...library.items, ...builtinItems], [library.items, builtinItems])
  const visibleItems = allItems.filter(
    (item) =>
      item.kind === kind &&
      item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )

  const select = useCallback(
    (item: CapricornSnippet) => {
      // An awaited save/discard dialog can outlive the snapshot that opened it.
      const current = useSnippetStore.getState().library
      const latest = item.id.startsWith('builtin:')
        ? item
        : (current.items.find((candidate) => candidate.id === item.id) ??
          builtinItems.find((candidate) => candidate.kind === item.kind)!)
      setDraft({ item: { ...latest }, baseline: fingerprint(latest), revision: current.revision })
      setError('')
      setPreview(undefined)
    },
    [builtinItems],
  )

  // Refresh untouched fields on remote changes, retaining a dirty draft and its original revision.
  useEffect(() => {
    if (dirty || busy) return
    const current = allItems.find((item) => item.id === draft.item.id)
    if (current && (draft.revision !== library.revision || fingerprint(current) !== draft.baseline))
      select(current)
    else if (!current && draft.baseline) select(builtinItems.find((item) => item.kind === kind)!)
  }, [
    allItems,
    builtinItems,
    busy,
    dirty,
    draft.baseline,
    draft.item.id,
    draft.revision,
    kind,
    library.revision,
    select,
  ])

  const save = useCallback(async (): Promise<boolean> => {
    if (builtin || !loaded || busy || !validSnippet(draft.item)) return false
    setBusy(true)
    setError('')
    try {
      const next = await mutateSnippet({ type: 'upsert', item: draft.item }, draft.revision)
      const saved = next.items.find((item) => item.id === draft.item.id)!
      setDraft({ item: saved, baseline: fingerprint(saved), revision: next.revision })
      setKind(saved.kind)
      return true
    } catch (reason) {
      setError(
        String(reason).includes('snippets_conflict')
          ? t('snippets.conflict')
          : `${t('snippets.saveError')}: ${String(reason)}`,
      )
      return false
    } finally {
      setBusy(false)
    }
  }, [builtin, busy, draft, loaded, t])

  const guard = useCallback((): Promise<boolean> => {
    if (pendingGuard.current) return pendingGuard.current
    if (busy) return Promise.resolve(false)
    if (!dirty) return Promise.resolve(true)
    const request = async () => {
      const action = await dialog.confirm({
        title: t('snippets.unsavedTitle'),
        content: t('snippets.unsavedDescription'),
        actions: [
          { id: 'cancel', label: t('common.cancel') },
          { id: 'discard', label: t('snippets.discard') },
          { id: 'save', label: t('snippets.save'), primary: true },
        ],
      })
      if (action === 'save') return save()
      if (action === 'discard') {
        setDraft((current) => ({ ...current, baseline: fingerprint(current.item) }))
        return true
      }
      return false
    }
    pendingGuard.current = request().finally(() => {
      pendingGuard.current = null
    })
    return pendingGuard.current
  }, [busy, dirty, save, t])

  useEffect(() => registerLeaveGuard(guard), [guard, registerLeaveGuard])
  const navigationRef = useRef(navigationId)
  useEffect(() => {
    if (navigationRef.current === navigationId) return
    navigationRef.current = navigationId
    // The settings shell has already accepted this navigation through the leave guard.
    setKind(initialKind)
    setQuery('')
    select(allItems.find((item) => item.kind === initialKind)!)
  }, [allItems, initialKind, navigationId, select])

  const changeKind = async (next: CapricornSnippetKind) => {
    if (next === kind || !(await guard())) return
    setKind(next)
    setQuery('')
    select(allItems.find((item) => item.kind === next)!)
  }
  const create = async (copy?: CapricornSnippet) => {
    if (!(await guard())) return
    const item: CapricornSnippet = copy
      ? { ...copy, id: userId(), title: `${copy.title} ${t('snippets.copySuffix')}` }
      : { id: userId(), title: '', kind, source: '', ...(kind === 'code' ? { language: '' } : {}) }
    setDraft({ item, baseline: '', revision: useSnippetStore.getState().library.revision })
    setKind(item.kind)
    setError('')
    setPreview(undefined)
  }
  const remove = async () => {
    if (!(await guard())) return
    const current = useSnippetStore.getState().library
    const removing = current.items.find((item) => item.id === draft.item.id)
    if (!removing) {
      setError(t('snippets.conflict'))
      return
    }
    const action = await dialog.confirm({
      title: t('snippets.deleteTitle', { title: removing.title }),
      actions: [
        { id: 'cancel', label: t('common.cancel') },
        { id: 'delete', label: t('snippets.delete'), danger: true },
      ],
    })
    if (action !== 'delete') return
    setBusy(true)
    try {
      const next = await mutateSnippet({ type: 'delete', id: removing.id }, current.revision)
      const item =
        next.items.find((candidate) => candidate.kind === kind) ??
        builtinItems.find((candidate) => candidate.kind === kind)!
      setDraft({ item, baseline: fingerprint(item), revision: next.revision })
      setError('')
      setPreview(undefined)
    } catch (reason) {
      setError(`${t('snippets.saveError')}: ${String(reason)}`)
    } finally {
      setBusy(false)
    }
  }
  const toggleHidden = async () => {
    setBusy(true)
    try {
      await mutateSnippet(
        { type: 'builtinVisibility', id: draft.item.id, hidden: !hidden },
        library.revision,
      )
      setError('')
    } catch (reason) {
      setError(`${t('snippets.saveError')}: ${String(reason)}`)
    } finally {
      setBusy(false)
    }
  }
  const update = (item: CapricornSnippet) => setDraft((current) => ({ ...current, item }))

  return (
    <div
      className='@container/snippets flex flex-col gap-3 text-ui-control'
      data-slot='snippet-settings'
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex min-w-0 flex-wrap gap-1' role='group' aria-label={t('snippets.kind')}>
          {kinds.map((value) => (
            <Button
              key={value}
              variant={kind === value ? 'secondary' : 'ghost'}
              size='sm'
              aria-pressed={kind === value}
              disabled={busy}
              onClick={() => void changeKind(value)}
            >
              {t(`snippets.kinds.${value}`)}
            </Button>
          ))}
        </div>
        <Button size='sm' disabled={!loaded || busy} onClick={() => void create()}>
          <Plus aria-hidden className='size-3.5' />
          {t('snippets.new')}
        </Button>
      </div>
      {loadError ? (
        <div role='alert' className='text-ui-control text-destructive'>
          {t('snippets.loadError')}: {loadError}{' '}
          <Button variant='ghost' size='sm' onClick={() => void loadSnippets()}>
            {t('snippets.retry')}
          </Button>
        </div>
      ) : null}
      <div className='grid min-w-0 gap-3 @min-[40rem]/snippets:grid-cols-[10.5rem_minmax(0,1fr)]'>
        <aside className='flex min-w-0 flex-col gap-1.5'>
          <Input
            inputSize='sm'
            className='shadow-none'
            type='search'
            autoComplete='off'
            spellCheck={false}
            aria-label={t('snippets.search')}
            placeholder={t('snippets.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div
            className='flex max-h-40 flex-col gap-0.5 overflow-y-auto @min-[40rem]/snippets:max-h-80'
            role='list'
            aria-label={t('snippets.library')}
          >
            {visibleItems.map((item) => (
              <div key={item.id} role='listitem'>
                <Button
                  variant='ghost'
                  size='sm'
                  disabled={busy}
                  aria-current={draft.item.id === item.id ? 'true' : undefined}
                  className={cn(
                    'h-auto min-h-7 w-full justify-start gap-1.5 whitespace-normal px-2 py-1 text-left font-normal',
                    draft.item.id === item.id && 'bg-control-selected font-medium',
                  )}
                  onClick={async () => {
                    if (draft.item.id !== item.id && (await guard())) select(item)
                  }}
                >
                  <span className='min-w-0 flex-1 break-words'>{item.title}</span>
                  {library.hiddenBuiltinIds.includes(item.id) ? (
                    <EyeOff
                      aria-label={t('snippets.hidden')}
                      className='size-3.5 shrink-0 text-muted-foreground'
                    />
                  ) : null}
                </Button>
              </div>
            ))}
            {!visibleItems.length ? (
              <p className='px-2 py-2 text-ui-control text-muted-foreground'>
                {t('snippets.noResults')}
              </p>
            ) : null}
          </div>
        </aside>
        <div className='@container/snippet-form flex min-w-0 flex-col gap-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='outline' size='sm' className='text-ui-caption'>
              {t(builtin ? 'snippets.builtin' : 'snippets.custom')}
            </Badge>
            {dirty ? (
              <span className='text-ui-caption text-muted-foreground'>{t('snippets.unsaved')}</span>
            ) : null}
            <div className='ml-auto flex flex-wrap justify-end gap-1'>
              <Button
                size='sm'
                variant='ghost'
                disabled={!loaded || busy}
                onClick={() => void create(draft.item)}
              >
                <Copy aria-hidden className='size-3.5' />
                {t(builtin ? 'snippets.copyCustom' : 'snippets.copy')}
              </Button>
              {builtin ? (
                <Button
                  size='sm'
                  variant='ghost'
                  disabled={!loaded || busy}
                  onClick={() => void toggleHidden()}
                >
                  {hidden ? (
                    <Eye aria-hidden className='size-3.5' />
                  ) : (
                    <EyeOff aria-hidden className='size-3.5' />
                  )}
                  {t(hidden ? 'snippets.show' : 'snippets.hide')}
                </Button>
              ) : library.items.some((item) => item.id === draft.item.id) ? (
                <Button
                  size='sm'
                  variant='destructive'
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  <Trash2 aria-hidden className='size-3.5' />
                  {t('snippets.delete')}
                </Button>
              ) : null}
            </div>
          </div>
          <div className='grid min-w-0 gap-2 @min-[24rem]/snippet-form:grid-cols-[minmax(0,1fr)_10rem]'>
            <label
              className='flex min-w-0 flex-col gap-1 text-ui-control'
              htmlFor={`${fieldsId}-title`}
            >
              {t('snippets.name')}
              <Input
                id={`${fieldsId}-title`}
                inputSize='sm'
                className='shadow-none'
                value={draft.item.title}
                readOnly={builtin}
                disabled={busy}
                onChange={(event) => update({ ...draft.item, title: event.target.value })}
              />
            </label>
            <div className='flex min-w-0 flex-col gap-1 text-ui-control'>
              <label htmlFor={`${fieldsId}-kind`}>{t('snippets.kind')}</label>
              <Select.Root
                value={draft.item.kind}
                disabled={builtin || busy}
                onValueChange={(value: CapricornSnippetKind) => {
                  const { id, title, source } = draft.item
                  update(
                    value === 'code'
                      ? { id, title, source, kind: value, language: '' }
                      : { id, title, source, kind: value },
                  )
                }}
              >
                <Select.Trigger id={`${fieldsId}-kind`} size='sm' className='shadow-none'>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {kinds.map((value) => (
                    <Select.Item key={value} value={value}>
                      {t(`snippets.kinds.${value}`)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
          </div>
          {draft.item.kind === 'code' ? (
            <label
              className='flex w-full max-w-80 flex-col gap-1 text-ui-control'
              htmlFor={`${fieldsId}-language`}
            >
              {t('snippets.language')}
              <Input
                id={`${fieldsId}-language`}
                inputSize='sm'
                className='shadow-none'
                value={draft.item.language ?? ''}
                placeholder={t('snippets.languagePlaceholder')}
                list={`${fieldsId}-languages`}
                readOnly={builtin}
                disabled={busy}
                onChange={(event) => {
                  if (draft.item.kind === 'code')
                    update({ ...draft.item, language: event.target.value })
                }}
              />
              <datalist id={`${fieldsId}-languages`}>
                {[
                  'bash',
                  'css',
                  'go',
                  'html',
                  'java',
                  'javascript',
                  'json',
                  'markdown',
                  'python',
                  'rust',
                  'sql',
                  'typescript',
                  'yaml',
                ].map((language) => (
                  <option key={language} value={language} />
                ))}
              </datalist>
            </label>
          ) : null}
          <div className='flex flex-col gap-1 text-ui-control'>
            <label htmlFor={`${fieldsId}-source`}>{t('snippets.source')}</label>
            <Textarea
              id={`${fieldsId}-source`}
              value={draft.item.source}
              readOnly={builtin}
              disabled={busy}
              spellCheck={false}
              rows={8}
              className='min-h-40 resize-y px-2.5 font-mono text-ui-control shadow-none'
              aria-describedby={`${fieldsId}-help`}
              onChange={(event) => update({ ...draft.item, source: event.target.value })}
            />
            <span id={`${fieldsId}-help`} className='text-ui-caption text-muted-foreground'>
              {t('snippets.sourceHelp')}
            </span>
          </div>
          {error ? (
            <p role='alert' className='m-0 text-ui-control text-destructive'>
              {error}
            </p>
          ) : null}
          <div className='flex flex-wrap items-center gap-1.5'>
            {!builtin ? (
              <Button
                size='sm'
                disabled={!loaded || busy || !dirty || !validSnippet(draft.item)}
                onClick={() => void save()}
              >
                {t('snippets.save')}
              </Button>
            ) : null}
            <Button
              variant='outline'
              size='sm'
              disabled={busy || !draft.item.source.trim()}
              onClick={() =>
                setPreview((previous) => ({ item: { ...draft.item }, id: (previous?.id ?? 0) + 1 }))
              }
            >
              <Eye aria-hidden className='size-3.5' />
              {t(preview ? 'snippets.previewAgain' : 'snippets.preview')}
            </Button>
            {preview && fingerprint(preview.item) !== fingerprint(draft.item) ? (
              <span role='status' className='text-ui-caption text-muted-foreground'>
                {t('snippets.previewStale')}
              </span>
            ) : null}
          </div>
          {preview ? (
            <Suspense
              fallback={
                <p role='status' className='text-ui-control text-muted-foreground'>
                  {t('common.fetching')}
                </p>
              }
            >
              <SnippetPreview key={preview.id} snippet={preview.item} />
            </Suspense>
          ) : null}
        </div>
      </div>
    </div>
  )
}
