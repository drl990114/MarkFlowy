import { commandRegistry } from '@/commands'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { TagCombobox } from '@/components/ui/tag-combobox'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import { collectBookmarkTags, selectVisibleBookmarks } from './query'
import { normalizeBookmarkError } from './repository'
import { loadBookmarkLibrary, mutateBookmark, useBookmarkStore } from './store'
import type { Bookmark } from './types'

interface BookmarkDraft {
  id?: string
  title: string
  path: string
  tags: string[]
}

interface DraftError {
  kind: 'load' | 'conflict' | 'missing' | 'save'
  message?: string
}

function toDraft(bookmark: Bookmark): BookmarkDraft {
  return { id: bookmark.id, title: bookmark.title, path: bookmark.target.path, tags: bookmark.tags }
}

export const BookMarkDialog: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<BookmarkDraft>({ title: '', path: '', tags: [] })
  const [revision, setRevision] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<DraftError | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const sessionRef = useRef(0)
  const savingSessionRef = useRef<number | null>(null)
  const library = useBookmarkStore((state) => state.library)
  const pendingRemovals = useBookmarkStore((state) => state.pendingRemovals)
  const { t } = useTranslation()

  useEffect(() => {
    const beginDraft = async (nextDraft: BookmarkDraft) => {
      const session = ++sessionRef.current
      setDraft(nextDraft)
      setRevision(null)
      setSaveError(null)
      setSaving(false)
      setLoading(true)
      setOpen(true)

      if (useBookmarkStore.getState().loadStatus !== 'ready') await loadBookmarkLibrary()
      if (session !== sessionRef.current) return
      const current = useBookmarkStore.getState()
      setLoading(false)
      if (current.loadStatus !== 'ready') {
        setSaveError({ kind: 'load', message: current.loadError ?? undefined })
        return
      }
      if (nextDraft.id) {
        const bookmark = current.library.items.find((item) => item.id === nextDraft.id)
        if (!bookmark) {
          setSaveError({ kind: 'missing' })
          return
        }
        setDraft(toDraft(bookmark))
      }
      setRevision(current.library.revision)
    }

    const d1 = commandRegistry.registerCommand({
      id: 'open_bookmark_dialog',
      handler: (file: { path: string; name: string }) =>
        beginDraft({ path: file.path, title: file.name, tags: [] }),
    })
    const d2 = commandRegistry.registerCommand({
      id: 'edit_bookmark_dialog',
      handler: (bookmark: Bookmark) => beginDraft(toDraft(bookmark)),
    })

    return () => {
      sessionRef.current += 1
      d1.dispose()
      d2.dispose()
    }
  }, [])

  const handleConfirm = async () => {
    const session = sessionRef.current
    if (revision === null || loading || savingSessionRef.current === session) return
    savingSessionRef.current = session
    setSaveError(null)
    setSaving(true)
    try {
      await mutateBookmark(
        draft.id
          ? { type: 'update', id: draft.id, changes: { title: draft.title, tags: draft.tags } }
          : {
              type: 'create',
              input: {
                title: draft.title,
                target: { kind: 'localFile', path: draft.path },
                tags: draft.tags,
              },
            },
        revision,
      )
      if (session === sessionRef.current) setOpen(false)
    } catch (error) {
      if (session !== sessionRef.current) return
      const failure = normalizeBookmarkError(error)
      const conflict = failure.code === 'conflict'
      setSaveError({ kind: conflict ? 'conflict' : 'save', message: failure.message })
      if (conflict) setRevision(null)
    } finally {
      if (savingSessionRef.current === session) savingSessionRef.current = null
      if (session === sessionRef.current) setSaving(false)
    }
  }

  const handleReload = async () => {
    const session = sessionRef.current
    setLoading(true)
    await loadBookmarkLibrary()
    if (session !== sessionRef.current) return
    const current = useBookmarkStore.getState()
    setLoading(false)
    if (current.loadStatus !== 'ready') {
      setSaveError({ kind: 'load', message: current.loadError ?? undefined })
      return
    }
    if (draft.id) {
      const bookmark = current.library.items.find((item) => item.id === draft.id)
      if (!bookmark) {
        setRevision(null)
        setSaveError({ kind: 'missing' })
        return
      }
      setDraft(toDraft(bookmark))
    }
    setRevision(current.library.revision)
    setSaveError(null)
  }

  const handleClose = () => {
    sessionRef.current += 1
    setSaveError(null)
    setOpen(false)
  }

  const tagOptions = useMemo(
    () => collectBookmarkTags(selectVisibleBookmarks(library.items, pendingRemovals))
      .map((tag) => ({ value: tag, label: tag })),
    [library.items, pendingRemovals],
  )
  const busy = saving || loading
  const canReload = saveError !== null && saveError.kind !== 'save'
  const errorLabel = saveError?.kind === 'conflict'
    ? t('bookmarks.saveConflict')
    : saveError?.kind === 'missing'
      ? t('bookmarks.noLongerExists')
      : saveError?.kind === 'load'
        ? t('bookmarks.loadError')
        : t('bookmarks.saveError')

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose()
      }}
    >
      <Dialog.Content aria-describedby={undefined} closeLabel={t('common.close')}>
        <Dialog.Header>
          <Dialog.Title>{t('action.bookmark')}</Dialog.Title>
        </Dialog.Header>

        <Dialog.Body>
          <div className='grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3'>
            <span className='text-right text-ui-control text-foreground-secondary'>
              {t('bookmarks.path')}
            </span>
            <span
              className='min-w-0 break-all py-1 text-ui-caption text-foreground-secondary'
              title={draft.path}
            >
              {draft.path}
            </span>

            <label className='text-right text-ui-control text-foreground-secondary' htmlFor='bookmark-name'>
              {t('bookmarks.name')}
            </label>
            <Input
              aria-invalid={saveError ? true : undefined}
              disabled={busy}
              id='bookmark-name'
              inputSize='sm'
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />

            <span className='text-right text-ui-control text-foreground-secondary' id='bookmark-tags-label'>
              {t('bookmarks.tags')}
            </span>
            <div className='min-w-0'>
              <TagCombobox
                allowCreate
                aria-labelledby='bookmark-tags-label'
                createLabel={t('bookmarks.create_tag')}
                disabled={busy}
                emptyText={t('bookmarks.no_tags_found')}
                onValuesChange={(tags) => setDraft((current) => ({ ...current, tags }))}
                options={tagOptions}
                placeholder={t('bookmarks.tag_placeholder')}
                removeLabel={(tag) => t('bookmarks.remove_tag', { tag })}
                values={draft.tags}
              />
            </div>
            {saveError ? (
              <div
                className='col-span-2 rounded-sm border border-destructive/45 bg-destructive/10 px-2 py-1.5 text-ui-caption text-destructive'
                role='alert'
              >
                <span className='font-medium'>{errorLabel}</span>
                {saveError.kind === 'load' || saveError.kind === 'save' ? (
                  <span className='ml-1 break-all'>{saveError.message}</span>
                ) : null}
                {canReload ? (
                  <Button
                    className='mt-2'
                    disabled={busy}
                    onClick={() => void handleReload()}
                    size='sm'
                    variant='outline'
                  >
                    {t(draft.id ? 'bookmarks.reloadBookmark' : 'bookmarks.reloadLibrary')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </Dialog.Body>

        <Dialog.Footer>
          <Button disabled={busy} onClick={handleClose} variant='outline'>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={busy || revision === null || draft.title.trim().length === 0}
            onClick={() => void handleConfirm()}
          >
            {saving ? t('bookmarks.saving') : loading ? t('bookmarks.loading') : t('common.confirm')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  )
}
