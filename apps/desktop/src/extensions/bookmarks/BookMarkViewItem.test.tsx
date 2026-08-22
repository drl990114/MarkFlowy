import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookMarkViewItem } from './BookMarkViewItem'

afterEach(cleanup)

describe('BookMarkViewItem', () => {
  it('uses a named native button and opens the bookmark', () => {
    const onClick = vi.fn()
    const bookmark = {
      id: 'bookmark-1',
      path: '/workspace/notes.md',
      tags: ['work'],
      title: 'Project notes',
    }

    render(<BookMarkViewItem bookmark={bookmark} onClick={onClick} />)

    const button = screen.getByRole('button', { name: 'Project notes' })
    expect(button.getAttribute('type')).toBe('button')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledWith(bookmark)
  })
})
