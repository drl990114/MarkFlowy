import { Tag } from '@/components/UI/Tag'
import type { BookMarkItem } from './useBookMarksStore'

interface BookMarkViewItemProps {
  bookmark: BookMarkItem
  onClick: (bookmark: BookMarkItem) => void
  showTags?: boolean
}

export const BookMarkViewItem = (props: BookMarkViewItemProps) => {
  const { bookmark, onClick, showTags = true } = props

  const handleClick = () => onClick(bookmark)

  return (
    <div
      className='bookmark-list__item'
      data-id={bookmark.id}
      key={bookmark.id}
      onClick={handleClick}
    >
      {bookmark.title}
      {showTags && bookmark.tags.length > 0 ? (
        <div data-id={bookmark.id}>
          {bookmark.tags.map((tag) => (
            <Tag className='bookmark-list__tag' key={tag}>
              {tag}
            </Tag>
          ))}
        </div>
      ) : null}
    </div>
  )
}
