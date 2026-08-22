import { TooltipProvider } from '@/components/ui/tooltip'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FindController } from './find-controller'

afterEach(cleanup)

describe('FindController', () => {
  it('uses the shared Lucide chrome contract for every icon-only action', () => {
    const findPrev = vi.fn()
    const findNext = vi.fn()
    const stopFind = vi.fn()
    const toggleCaseSensitive = vi.fn()
    const onDismiss = vi.fn()

    const { container } = render(
      <TooltipProvider>
        <FindController
          caseSensitive={false}
          findNext={findNext}
          findPrev={findPrev}
          onDismiss={onDismiss}
          stopFind={stopFind}
          toggleCaseSensitive={toggleCaseSensitive}
        />
      </TooltipProvider>,
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
    for (const button of buttons) {
      expect(button.className).toContain('size-[22px]')
      expect(button.className).toContain('[&_svg]:size-3.5')
      expect(button.querySelector('svg')?.getAttribute('width')).toBe('14')
    }
    expect(container.querySelector('i')).toBeNull()

    const matchCase = screen.getByRole('button', { name: 'Match case' })
    expect(matchCase.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Find previous match' }))
    fireEvent.click(screen.getByRole('button', { name: 'Find next match' }))
    fireEvent.click(matchCase)
    fireEvent.click(screen.getByRole('button', { name: 'Close find and replace' }))

    expect(findPrev).toHaveBeenCalledOnce()
    expect(findNext).toHaveBeenCalledOnce()
    expect(toggleCaseSensitive).toHaveBeenCalledOnce()
    expect(stopFind).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('exposes the active match-case state through aria-pressed', () => {
    render(
      <TooltipProvider>
        <FindController
          caseSensitive
          findNext={vi.fn()}
          findPrev={vi.fn()}
          stopFind={vi.fn()}
          toggleCaseSensitive={vi.fn()}
        />
      </TooltipProvider>,
    )

    expect(
      screen.getByRole('button', { name: 'Match case' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })
})
