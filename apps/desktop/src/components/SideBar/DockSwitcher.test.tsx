import { TooltipProvider } from '@/components/ui/tooltip'
import useLayoutStore from '@/stores/useLayoutStore'
import { desktopDarkTheme } from '@markflowy/theme'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DockSwitcher } from './DockSwitcher'

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

beforeEach(() => {
  useLayoutStore.setState({
    leftBar: { activePanelId: 'explorer', size: 240, visible: true },
    rightBar: { activePanelId: 'toc', size: 280, visible: true },
    overlayDock: null,
    viewportMode: 'wide',
    zenModeActive: false,
  })
})

afterEach(cleanup)

function renderSwitcher() {
  return render(
    <ThemeProvider theme={desktopDarkTheme}>
      <TooltipProvider>
        <DockSwitcher side='left' />
      </TooltipProvider>
    </ThemeProvider>,
  )
}

describe('DockSwitcher', () => {
  it('uses the theme accent only on the active icon', () => {
    renderSwitcher()

    const explorer = screen.getByRole('button', { name: /files|explorer/i })
    const search = screen.getByRole('button', { name: /search/i })

    expect(explorer.getAttribute('aria-pressed')).toBe('true')
    expect(search.getAttribute('aria-pressed')).toBe('false')
    expect(explorer.querySelector('svg')?.getAttribute('class')).toContain('text-primary')
    expect(search.querySelector('svg')?.getAttribute('class') ?? '').not.toContain('text-primary')

    fireEvent.click(search)

    expect(explorer.querySelector('svg')?.getAttribute('class') ?? '').not.toContain(
      'text-primary',
    )
    expect(search.querySelector('svg')?.getAttribute('class')).toContain('text-primary')
  })

  it('switches to another panel without closing the Dock', () => {
    renderSwitcher()

    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    expect(useLayoutStore.getState().leftBar).toMatchObject({
      activePanelId: 'search',
      visible: true,
    })
  })

  it('closes the Dock when the active panel is pressed again', () => {
    renderSwitcher()

    const explorer = screen.getByRole('button', { name: /files|explorer/i })
    fireEvent.click(explorer)

    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
    expect(explorer.getAttribute('aria-pressed')).toBe('false')
    expect(explorer.querySelector('svg')?.getAttribute('class') ?? '').not.toContain(
      'text-primary',
    )
  })
})
