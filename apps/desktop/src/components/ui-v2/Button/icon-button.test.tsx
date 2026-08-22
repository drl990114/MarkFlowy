import { TooltipProvider } from '@/components/ui/tooltip'
import { desktopDarkTheme } from '@markflowy/theme'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'
import { MfIconButton } from './icon-button'

describe('MfIconButton compatibility adapter', () => {
  it('renders a named native button and preserves click behavior', () => {
    const onClick = vi.fn()

    render(
      <ThemeProvider theme={desktopDarkTheme}>
        <TooltipProvider>
          <MfIconButton
            icon='ri-search-line'
            onClick={onClick}
            tooltipProps={{ title: 'Search' }}
          />
        </TooltipProvider>
      </ThemeProvider>,
    )

    const button = screen.getByRole('button', { name: 'Search' })
    expect(button.getAttribute('type')).toBe('button')
    expect(button.querySelector('i')?.getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('uses the disabled attribute instead of a click-only visual state', () => {
    render(
      <ThemeProvider theme={desktopDarkTheme}>
        <MfIconButton ariaLabel='Disabled action' disabled icon='ri-close-line' onClick={vi.fn()} />
      </ThemeProvider>,
    )

    expect(screen.getByRole('button', { name: 'Disabled action' }).hasAttribute('disabled')).toBe(
      true,
    )
  })
})
