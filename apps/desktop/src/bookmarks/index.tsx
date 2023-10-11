import { Container } from './styles'
import { RIGHTBARITEMKEYS } from '@/constants'
import type { RightBarItem } from '@/components/SideBar'
import type { BookMarkItem } from './useBookMarksStore'
import useBookMarksStore from './useBookMarksStore'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TagsViewItem } from './TagsViewItem'
import { BookMarkViewItem } from './BookMarkViewItem'
import type { BookMarkContextMenuRef } from './BookMarkContextMenu'
import { BookMarkContextMenu } from './BookMarkContextMenu'
import type { RightNavItem } from '@/components/SideBar/SideBarHeader'
import SideBarHeader from '@/components/SideBar/SideBarHeader'

type BookMarkViewMode = 'list' | 'tags'

export interface TagView {
  tag: string
  bookmarks: BookMarkItem[]
}

const BookMarksList: React.FC<ChatListProps> = (props) => {
  const { bookMarkList, openBookMark } = useBookMarksStore()
  const [tagsViewList, setTagsViewList] = useState<TagView[]>([])
  const contextMenuRef = useRef<BookMarkContextMenuRef>(null)
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
          contextMenuRef.current?.open({
            x: e.clientX,
            y: e.clientY,
            bookmark,
          })
        }
      }
    },
    [bookMarkList, contextMenuRef],
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
            tooltip: { title: 'toogle view mode', arrow: true },
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
      <BookMarkContextMenu ref={contextMenuRef} />
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
