import type { RightBarItem } from '@/components/SideBar'
import type { RightNavItem } from '@/components/SideBar/SideBarHeader'
import SideBarHeader from '@/components/SideBar/SideBarHeader'
import { showContextMenu } from '@/components/ui-v2/ContextMenu/ContextMenu'
import { RIGHTBARITEMKEYS } from '@/constants'
import { useCommandStore } from '@/stores'
import { useCallback, useEffect, useState } from 'react'
import { BookMarkViewItem } from './BookMarkViewItem'
import { Container } from './styles'
import { TagsViewItem } from './TagsViewItem'
import type { BookMarkItem } from './useBookMarksStore'
import useBookMarksStore from './useBookMarksStore'

type BookMarkViewMode = 'list' | 'tags'

export interface TagView {
  tag: string
  bookmarks: BookMarkItem[]
}

const BookMarksList: React.FC<ChatListProps> = (props) => {
  const { bookMarkList, openBookMark } = useBookMarksStore()
  const [tagsViewList, setTagsViewList] = useState<TagView[]>([])
  const [viewMode, setViewMode] = useState<BookMarkViewMode>('list')

  const getTagsViewList = useCallback(() => {
    const targetTagsViewList: TagView[] = []
    bookMarkList.forEach((bookmark) => {
      if (bookmark.tags.length > 0) {
        bookmark.tags.forEach((tag) => {
          const tagView = targetTagsViewList.find((item) => item.tag === tag)
          if (tagView) {
            tagView.bookmarks.push(bookmark)
          } else {
            targetTagsViewList.push({
              tag,
              bookmarks: [bookmark],
            })
          }
        })
      }
    })
    setTagsViewList(targetTagsViewList)
  }, [bookMarkList])

  const handleContextMenu = useCallback(
    (
      e: React.MouseEvent<HTMLDivElement, MouseEvent> & {
        target: { dataset: Record<string, any> }
      },
    ) => {
      e.preventDefault()
      e.stopPropagation()
      const bookMarkId = e.target?.dataset?.id
      if (bookMarkId) {
        const bookmark = bookMarkList.find((item) => item.id === bookMarkId)
        if (bookmark) {
          showContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
              {
                value: 'edit',
                label: 'Edit',
                handler: () => {
                  useCommandStore.getState().execute('edit_bookmark_dialog', bookmark)
                }
              },
              {
                value: 'remove',
                label: 'Remove',
                handler: () => {
                  useBookMarksStore.getState().removeBookMark(bookmark.id)
                  
                },
              }
            ]
          })
        }
      }
    },
    [bookMarkList],
  )
  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'list' ? 'tags' : 'list'))
    getTagsViewList()
  }, [getTagsViewList])

  useEffect(() => {
    getTagsViewList()
  }, [getTagsViewList])

  const handleRightNavItemClick = useCallback(
    (item: RightNavItem) => {
      if (item.key === 'toggleViewMode') {
        toggleViewMode()
      }
    },
    [toggleViewMode],
  )

  return (
    <Container {...props}>
      <SideBarHeader
        name='BookMarks'
        onRightNavItemClick={handleRightNavItemClick}
        rightNavItems={[
          {
            iconCls: viewMode === 'list' ? 'ri-price-tag-3-line' : 'ri-list-unordered',
            key: 'toggleViewMode',
            tooltip: { title: 'toogle view mode' },
          },
        ]}
      />
      <div className='bookmark-list' onContextMenu={handleContextMenu}>
        {viewMode === 'list'
          ? bookMarkList.map((bookmark) => {
              return (
                <BookMarkViewItem key={bookmark.id} bookmark={bookmark} onClick={openBookMark} />
              )
            })
          : tagsViewList.map((tagView) => {
              return <TagsViewItem tagView={tagView} key={tagView.tag} />
            })}
      </div>
    </Container>
  )
}

interface ChatListProps {
  className?: string
}

const BookMarks = {
  title: RIGHTBARITEMKEYS.BookMarks,
  key: RIGHTBARITEMKEYS.BookMarks,
  icon: <i className='ri-bookmark-line' />,
  components: <BookMarksList />,
} as RightBarItem

export default BookMarks
