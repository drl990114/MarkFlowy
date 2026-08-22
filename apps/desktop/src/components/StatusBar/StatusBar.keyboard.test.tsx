import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { handleStatusBarKeyDown } from './keyboardNavigation'

function KeyboardFixture() {
  return (
    <div onKeyDown={handleStatusBarKeyDown} role='toolbar'>
      <button data-mf-status-bar-button='' type='button'>
        First
      </button>
      <button data-mf-status-bar-button='' type='button'>
        Second
      </button>
      <button data-mf-status-bar-button='' disabled type='button'>
        Disabled
      </button>
    </div>
  )
}

describe('status bar keyboard navigation', () => {
  it('moves focus with horizontal arrow keys, skips disabled controls, and stops at the edges', () => {
    render(<KeyboardFixture />)
    const first = screen.getByRole('button', { name: 'First' })
    const second = screen.getByRole('button', { name: 'Second' })

    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(second)

    fireEvent.keyDown(second, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(second)

    fireEvent.keyDown(second, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(first)
  })
})
