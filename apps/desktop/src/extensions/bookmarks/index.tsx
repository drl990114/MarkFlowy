import { commandRegistry } from '@/commands'
import { AsyncSurface, type AsyncSurfaceState } from '@/components/AsyncSurface'
import type { RightBarItem } from '@/components/SideBar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { showContextMenu } from '@/components/ui-v2/ContextMenu/ContextMenu'
import { RIGHTBARITEMKEYS } from '@/constants'
import { useTranslation } from '@/i18n'
import { ArrowDownUpIcon, BookmarkIcon, CheckIcon, ListIcon, TagsIcon } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { toast } from 'zens'
import { openBookmark } from './actions'
import { BookMarkViewItem } from './BookMarkViewItem'
import { queryBookmarks, selectVisibleBookmarks } from './query'
import { BOOKMARK_UNDO_DURATION_MS, loadBookmarkLibrary, useBookmarkStore } from './store'
import { Container } from './styles'
import { TagsViewItem } from './TagsViewItem'
import type { Bookmark, BookmarkViewConfig } from './types'
import { useBookmarkViewStore } from './viewStore'

const SORT_OPTIONS: {
  value: string
  label: string
  sort: BookmarkViewConfig['sort']
}[] = [
  { value: 'title:asc', label: 'bookmarks.sortNameAsc', sort: { field: 'title', direction: 'asc' } },
  { value: 'title:desc', label: 'bookmarks.sortNameDesc', sort: { field: 'title', direction: 'desc' } },
  {
    value: 'createdAt:desc',
    label: 'bookmarks.sortNewest',
    sort: { field: 'createdAt', direction: 'desc' },
  },
  {
    value: 'createdAt:asc',
    label: 'bookmarks.sortOldest',
    sort: { field: 'createdAt', direction: 'asc' },
  },
]

export const BookMarksList = (props: BookMarksListProps) => {
  const { t, i18n } = useTranslation()
  const library = useBookmarkStore((state) => state.library)
  const pendingRemovals = useBookmarkStore((state) => state.pendingRemovals)
  const loadError = useBookmarkStore((state) => state.loadError)
  const loadStatus = useBookmarkStore((state) => state.loadStatus)
  const migrationWarning = useBookmarkStore((state) => state.migrationWarning)
  const mutationError = useBookmarkStore((state) => state.mutationError)
  const retryBookmarkRemoval = useBookmarkStore((state) => state.retryBookmarkRemoval)
  const config = useBookmarkViewStore((state) => state.config)
  const setGroupBy = useBookmarkViewStore((state) => state.setGroupBy)
  const setSort = useBookmarkViewStore((state) => state.setSort)
  const visibleBookmarks = useMemo(
    () => selectVisibleBookmarks(library.items, pendingRemovals),
    [library.items, pendingRemovals],
  )
  const result = useMemo(
    () => queryBookmarks(visibleBookmarks, config, i18n.language),
    [visibleBookmarks, config, i18n.language],
  )
  const sortValue = `${config.sort.field}:${config.sort.direction}`
  const sortLabel = t(SORT_OPTIONS.find((option) => option.value === sortValue)?.label ?? 'bookmarks.sort')
  const viewLabel = t(config.groupBy === 'none' ? 'bookmarks.viewByTags' : 'bookmarks.viewAsList')

  const removeBookmarkWithUndo = useCallback(
    (bookmark: Bookmark) => {
      const store = useBookmarkStore.getState()
      const removedBookmark = store.removeBookmark(bookmark.id)
      if (!removedBookmark) return

      toast(t('bookmarks.removed', { title: removedBookmark.title }), {
        action: {
          label: t('bookmarks.undo'),
          onClick: () => {
            store.undoRemoveBookmark(removedBookmark.id)
          },
        },
        duration: BOOKMARK_UNDO_DURATION_MS,
      })
    },
    [t],
  )

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const bookmarkButton = target.closest<HTMLElement>('[data-bookmark-id]')
      const bookmarkId = bookmarkButton?.dataset.bookmarkId
      if (!bookmarkId) return

      const bookmark = visibleBookmarks.find((item) => item.id === bookmarkId)
      if (!bookmark) return

      event.preventDefault()
      event.stopPropagation()
      showContextMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          {
            value: 'edit',
            label: t('action.edit'),
            handler: () => {
              commandRegistry.execute('edit_bookmark_dialog', bookmark)
            },
          },
          {
            value: 'remove',
            label: t('common.delete'),
            handler: () => removeBookmarkWithUndo(bookmark),
          },
        ],
      })
    },
    [visibleBookmarks, removeBookmarkWithUndo, t],
  )

  const surfaceState = useMemo<AsyncSurfaceState<BookmarkViewConfig['groupBy']>>(() => {
    if (loadStatus === 'idle' || loadStatus === 'loading') {
      return { status: 'loading', label: t('bookmarks.loading') }
    }
    if (loadStatus === 'error') {
      return {
        status: 'error',
        title: t('bookmarks.loadError'),
        description: loadError ?? undefined,
        retry: () => void loadBookmarkLibrary(),
      }
    }
    if (visibleBookmarks.length === 0) {
      return { status: 'empty', title: t('bookmarks.empty') }
    }
    return { status: 'ready', data: config.groupBy }
  }, [loadError, loadStatus, t, config.groupBy, visibleBookmarks.length])

  return (
    <Container {...props}>
      <div className='bookmark-list' onContextMenu={handleContextMenu}>
        <div className='bookmark-list__toolbar'>
          <DropdownMenuRoot>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={t('bookmarks.sort')}
                    size='icon-chrome'
                    variant='chrome'
                  >
                    <ArrowDownUpIcon aria-hidden='true' size={14} strokeWidth={1.75} />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{`${t('bookmarks.sort')}: ${sortLabel}`}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align='end' aria-label={t('bookmarks.sort')}>
              <DropdownMenuRadioGroup
                value={sortValue}
                onValueChange={(value) => {
                  const option = SORT_OPTIONS.find((item) => item.value === value)
                  if (option) setSort(option.sort)
                }}
              >
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    <span aria-hidden='true' className='flex size-3.5 shrink-0 items-center justify-center'>
                      {sortValue === option.value ? <CheckIcon size={14} strokeWidth={1.75} /> : null}
                    </span>
                    {t(option.label)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenuRoot>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={viewLabel}
                data-mf-dock-initial-focus=''
                onClick={() => setGroupBy(config.groupBy === 'none' ? 'tag' : 'none')}
                size='icon-chrome'
                variant='chrome'
              >
                {config.groupBy === 'none' ? (
                  <TagsIcon aria-hidden='true' size={14} strokeWidth={1.75} />
                ) : (
                  <ListIcon aria-hidden='true' size={14} strokeWidth={1.75} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{viewLabel}</TooltipContent>
          </Tooltip>
        </div>
        <div className='bookmark-list__content'>
          {migrationWarning ? (
            <div className='flex items-start gap-2 px-2 py-1.5 text-ui-caption text-foreground-secondary' role='status'>
              <span className='min-w-0 flex-1'>
                {t(migrationWarning.code === 'cleanupFailed'
                  ? 'bookmarks.legacyCleanupWarning'
                  : 'bookmarks.legacyConflictWarning')}
              </span>
              <Button onClick={() => void loadBookmarkLibrary()} size='sm' variant='outline'>
                {t('bookmarks.retry')}
              </Button>
            </div>
          ) : null}
          {mutationError ? (
            <div className='bookmark-list__error' role='alert' title={mutationError.message}>
              <span>{t('bookmarks.removeFailed')}</span>
              <Button
                onClick={() => void retryBookmarkRemoval(mutationError.bookmarkId)}
                size='sm'
                variant='outline'
              >
                {t('bookmarks.retry')}
              </Button>
            </div>
          ) : null}
          <AsyncSurface retryLabel={t('bookmarks.retry')} state={surfaceState}>
            {(groupBy) =>
              groupBy === 'none'
                ? result.items.map((bookmark) => (
                    <BookMarkViewItem bookmark={bookmark} key={bookmark.id} onClick={openBookmark} />
                  ))
                : result.groups.map((group) => (
                    <TagsViewItem key={group.id} onOpen={openBookmark} tagView={group} />
                  ))
            }
          </AsyncSurface>
        </div>
      </div>
    </Container>
  )
}

interface BookMarksListProps {
  className?: string
}

const BookMarks = {
  title: RIGHTBARITEMKEYS.BookMarks,
  key: RIGHTBARITEMKEYS.BookMarks,
  icon: <BookmarkIcon aria-hidden='true' size={14} strokeWidth={1.75} />,
  components: <BookMarksList />,
} as RightBarItem

export default BookMarks
