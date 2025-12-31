import { Flex, Tag } from 'antd'
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
        <Flex data-id={bookmark.id} gap={4}>
          {bookmark.tags.map((tag) => (
            <Tag key={tag} color='#0369a1' variant='solid'>{tag}</Tag>
          ))}
        </Flex>
      ) : null}
    </div>
  )
}
