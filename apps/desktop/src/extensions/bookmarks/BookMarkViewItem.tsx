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
    <button
      aria-label={bookmark.title}
      className='bookmark-list__item'
      data-bookmark-id={bookmark.id}
      onClick={handleClick}
      type='button'
    >
      <span className='bookmark-list__title'>{bookmark.title}</span>
      {showTags && bookmark.tags.length > 0 ? (
        <span className='bookmark-list__tags'>
          {bookmark.tags.map((tag) => (
            <Badge
              className='h-4 rounded-sm px-1 py-0 text-[10px] font-normal'
              key={tag}
              size='sm'
              variant='outline'
            >
              {tag}
            </Badge>
          ))}
        </span>
      ) : null}
    </button>
  )
}
