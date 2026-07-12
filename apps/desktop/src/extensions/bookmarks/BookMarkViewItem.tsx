import { Badge } from '@/components/ui/badge'
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
        <div className='flex gap-1' data-id={bookmark.id}>
          {bookmark.tags.map((tag) => (
            <Badge key={tag} variant='default'>
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
