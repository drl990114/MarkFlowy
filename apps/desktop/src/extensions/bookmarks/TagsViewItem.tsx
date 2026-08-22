import classNames from 'classnames'
import { ChevronRightIcon } from 'lucide-react'
import { memo, useState } from 'react'
import styled from 'styled-components'
import type { TagView } from '.'
import { BookMarkViewItem } from './BookMarkViewItem'
import type { BookMarkItem } from './useBookMarksStore'

interface TagsViewItemProps {
  onOpen: (bookmark: BookMarkItem) => void
  tagView: TagView
}

export const TagsViewItem = memo((props: TagsViewItemProps) => {
  const { onOpen, tagView } = props
  const [expand, setExpand] = useState(false)

  const toggleExpand = () => {
    setExpand((prev) => !prev)
  }

  const tagViewIconCls = classNames('arrow-icon', {
    'arrow-icon__down': expand,
  })

  return (
    <Container key={tagView.tag}>
      <button
        aria-expanded={expand}
        className='bookmark-tagsview__header bookmark-list__item'
        onClick={toggleExpand}
        type='button'
      >
        <span aria-hidden='true' className={tagViewIconCls}>
          <ChevronRightIcon size={14} strokeWidth={1.75} />
        </span>
        <span>{tagView.tag}</span>
      </button>
      {expand ? (
        <div className='bookmark-tagsview__child'>
          {tagView.bookmarks.map((bookmark) => {
            return (
              <BookMarkViewItem
                key={bookmark.id}
                bookmark={bookmark}
                onClick={onOpen}
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
    display: inline-flex;
    flex: 0 0 14px;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: transform var(--mf-motion-duration-fast, 120ms)
      var(--mf-motion-ease-out, cubic-bezier(0.23, 1, 0.32, 1));

    &__down {
      transform: rotate(90deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .arrow-icon {
      transition: none;
    }
  }
`
