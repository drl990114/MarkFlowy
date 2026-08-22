import { TooltipProvider } from '@/components/ui/tooltip'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SearchIcon } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getNextSearchRowIndex, SearchActionButton } from '.'

afterEach(cleanup)

describe('SearchActionButton', () => {
  it('uses a semantic Lucide icon button without the legacy font icon adapter', () => {
    const onClick = vi.fn()

    const { container } = render(
      <TooltipProvider>
        <SearchActionButton icon={SearchIcon} label='Search files' onClick={onClick} pressed />
      </TooltipProvider>,
    )

    const button = screen.getByRole('button', { name: 'Search files' })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.className).toContain('text-primary')
    expect(button.className).not.toContain('bg-control-selected')
    expect(button.querySelector('svg')).toBeTruthy()
    expect(container.querySelector('i')).toBeNull()

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('announces one-shot progress without exposing a toggle state', () => {
    render(
      <TooltipProvider>
        <SearchActionButton icon={SearchIcon} label='Search files' onClick={vi.fn()} spinning />
      </TooltipProvider>,
    )

    const button = screen.getByRole('button', { name: 'Search files' })
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.hasAttribute('aria-pressed')).toBe(false)
  })
})

describe('search result keyboard navigation', () => {
  it('keeps virtualized rows reachable with arrows and Home/End', () => {
    expect(getNextSearchRowIndex(0, 20, 'ArrowDown')).toBe(1)
    expect(getNextSearchRowIndex(19, 20, 'ArrowDown')).toBe(19)
    expect(getNextSearchRowIndex(8, 20, 'ArrowUp')).toBe(7)
    expect(getNextSearchRowIndex(8, 20, 'Home')).toBe(0)
    expect(getNextSearchRowIndex(8, 20, 'End')).toBe(19)
    expect(getNextSearchRowIndex(0, 0, 'End')).toBeNull()
  })
})
