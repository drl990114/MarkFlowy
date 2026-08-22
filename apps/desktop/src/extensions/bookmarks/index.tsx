import { commandRegistry } from '@/commands'
import { AsyncSurface, type AsyncSurfaceState } from '@/components/AsyncSurface'
import { scheduleActiveEditorFocus } from '@/components/EditorArea/focusActiveEditor'
import type { RightBarItem } from '@/components/SideBar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { showContextMenu } from '@/components/ui-v2/ContextMenu/ContextMenu'
import { RIGHTBARITEMKEYS } from '@/constants'
import { useTranslation } from '@/i18n'
import { closeCompactLeftDockAfterSelection } from '@/stores/useLayoutStore'
import { BookmarkIcon, ListIcon, TagsIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'zens'
import { BookMarkViewItem } from './BookMarkViewItem'
import { Container } from './styles'
import { TagsViewItem } from './TagsViewItem'
import {
  BOOKMARK_UNDO_DURATION_MS,
  type BookMarkItem,
} from './useBookMarksStore'
import useBookMarksStore from './useBookMarksStore'

type BookMarkViewMode = 'list' | 'tags'

export interface TagView {
  tag: string
  bookmarks: BookMarkItem[]
}

function buildTagsViewList(bookmarks: BookMarkItem[]) {
  const tagViews = new Map<string, BookMarkItem[]>()
  bookmarks.forEach((bookmark) => {
    bookmark.tags.forEach((tag) => {
      tagViews.set(tag, [...(tagViews.get(tag) ?? []), bookmark])
    })
  })

  return [...tagViews].map(([tag, taggedBookmarks]) => ({
    tag,
    bookmarks: taggedBookmarks,
  }))
}

export const BookMarksList = (props: BookMarksListProps) => {
  const { t } = useTranslation()
  const bookMarkList = useBookMarksStore((state) => state.bookMarkList)
  const getBookMarkList = useBookMarksStore((state) => state.getBookMarkList)
  const loadError = useBookMarksStore((state) => state.loadError)
  const loadStatus = useBookMarksStore((state) => state.loadStatus)
  const mutationError = useBookMarksStore((state) => state.mutationError)
  const openBookMark = useBookMarksStore((state) => state.openBookMark)
  const retryBookMarkRemoval = useBookMarksStore((state) => state.retryBookMarkRemoval)
  const [viewMode, setViewMode] = useState<BookMarkViewMode>('list')
  const tagsViewList = useMemo(() => buildTagsViewList(bookMarkList), [bookMarkList])

  useEffect(() => {
    if (loadStatus === 'idle') void getBookMarkList()
  }, [getBookMarkList, loadStatus])

  const removeBookMarkWithUndo = useCallback(
    (bookmark: BookMarkItem) => {
      const store = useBookMarksStore.getState()
      const removedBookmark = store.removeBookMark(bookmark.id)
      if (!removedBookmark) return

      toast(t('bookmarks.removed', { title: removedBookmark.title }), {
        action: {
          label: t('bookmarks.undo'),
          onClick: () => {
            store.undoRemoveBookMark(removedBookmark.id)
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
      const bookMarkId = bookmarkButton?.dataset.bookmarkId
      if (!bookMarkId) return

      const bookmark = bookMarkList.find((item) => item.id === bookMarkId)
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
            handler: () => removeBookMarkWithUndo(bookmark),
          },
        ],
      })
    },
    [bookMarkList, removeBookMarkWithUndo, t],
  )

  const toggleViewMode = useCallback(() => {
    setViewMode((previousViewMode) => (previousViewMode === 'list' ? 'tags' : 'list'))
  }, [])

  const handleOpenBookMark = useCallback(
    (bookmark: BookMarkItem) => {
      openBookMark(bookmark)
      if (closeCompactLeftDockAfterSelection()) scheduleActiveEditorFocus()
    },
    [openBookMark],
  )

  const visibleItems = viewMode === 'list' ? bookMarkList : tagsViewList
  const surfaceState = useMemo<AsyncSurfaceState<BookMarkViewMode>>(() => {
    if (loadStatus === 'idle' || loadStatus === 'loading') {
      return { status: 'loading', label: t('bookmarks.loading') }
    }
    if (loadStatus === 'error') {
      return {
        status: 'error',
        title: t('bookmarks.loadError'),
        description: loadError,
        retry: () => void getBookMarkList(),
      }
    }
    if (visibleItems.length === 0) {
      return {
        status: 'empty',
        title: t(viewMode === 'list' ? 'bookmarks.empty' : 'bookmarks.emptyTags'),
      }
    }
    return { status: 'ready', data: viewMode }
  }, [getBookMarkList, loadError, loadStatus, t, viewMode, visibleItems.length])

  return (
    <Container {...props}>
      <div className='bookmark-list' onContextMenu={handleContextMenu}>
        <div className='bookmark-list__toolbar'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t(
                  viewMode === 'list' ? 'bookmarks.viewByTags' : 'bookmarks.viewAsList',
                )}
                data-mf-dock-initial-focus=''
                onClick={toggleViewMode}
                size='icon-chrome'
                variant='chrome'
              >
                {viewMode === 'list' ? (
                  <TagsIcon aria-hidden='true' size={14} strokeWidth={1.75} />
                ) : (
                  <ListIcon aria-hidden='true' size={14} strokeWidth={1.75} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t(viewMode === 'list' ? 'bookmarks.viewByTags' : 'bookmarks.viewAsList')}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className='bookmark-list__content'>
          {mutationError ? (
            <div className='bookmark-list__error' role='alert' title={mutationError.message}>
              <span>{t('bookmarks.removeFailed')}</span>
              <Button
                onClick={() => void retryBookMarkRemoval(mutationError.bookmarkId)}
                size='sm'
                variant='outline'
              >
                {t('bookmarks.retry')}
              </Button>
            </div>
          ) : null}
          <AsyncSurface retryLabel={t('bookmarks.retry')} state={surfaceState}>
            {(readyViewMode) =>
              readyViewMode === 'list'
                ? bookMarkList.map((bookmark) => (
                    <BookMarkViewItem
                      bookmark={bookmark}
                      key={bookmark.id}
                      onClick={handleOpenBookMark}
                    />
                  ))
                : tagsViewList.map((tagView) => (
                    <TagsViewItem key={tagView.tag} onOpen={handleOpenBookMark} tagView={tagView} />
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
