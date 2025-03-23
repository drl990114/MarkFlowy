import { memo, useState } from 'react'
import type { TagView } from '.'
import styled from 'styled-components'
import classNames from 'classnames'
import { BookMarkViewItem } from './BookMarkViewItem'
import useBookMarksStore from './useBookMarksStore'

interface TagsViewItemProps {
  tagView: TagView
}

export const TagsViewItem = memo((props: TagsViewItemProps) => {
  const { tagView } = props
  const { openBookMark } = useBookMarksStore()
  const [expand, setExpand] = useState(false)

  const toggleExpand = () => {
    setExpand((prev) => !prev)
  }

  const tagViewIconCls = classNames('arrow-icon', {
    'arrow-icon__down': expand,
  })

  return (
    <Container key={tagView.tag}>
      <div className='bookmark-tagsview__header bookmark-list__item' onClick={toggleExpand}>
        <div className={tagViewIconCls}>
          <i className='ri-arrow-drop-right-line'></i>
        </div>
        <div>{tagView.tag}</div>
      </div>
      {expand ? (
        <div className='bookmark-tagsview__child'>
          {tagView.bookmarks.map((bookmark) => {
            return (
              <BookMarkViewItem
                key={bookmark.id}
                bookmark={bookmark}
                onClick={openBookMark}
                showTags={false}
              />
            )
          })}
        </div>
      ) : null}
    </Container>
  )
})

const Container = styled.div`
  .bookmark-tagsview {
    &__header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    &__child {
      display: flex;
      flex-direction: column;
      margin-left: 16px;
    }
  }

  .arrow-icon {
    display: inline-block;
    font-size: 1.4rem;
    line-height: normal;

    &__down {
      transform: rotate(90deg);
    }
  }
`
