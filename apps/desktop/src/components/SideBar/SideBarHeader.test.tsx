import { desktopDarkTheme } from '@markflowy/theme'
import { TooltipProvider } from '@/components/ui/tooltip'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'
import SideBarHeader from './SideBarHeader'

describe('SideBarHeader', () => {
  it('renders compact semantic actions without exposing decorative icons', () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={desktopDarkTheme}>
        <TooltipProvider>
          <SideBarHeader
            name='Outline'
            onRightNavItemClick={vi.fn()}
            rightNavItems={[
              {
                iconCls: 'ri-add-line',
                key: 'add',
                tooltip: { title: 'Add item' },
              },
            ]}
          />
        </TooltipProvider>
      </ThemeProvider>,
    )

    expect(markup).toContain('mf-sidebar-header__name')
    expect(markup).toContain('>Outline<')
    expect(markup).toContain('<button')
    expect(markup).toContain('type="button"')
    expect(markup).toContain('aria-label="Add item"')
    expect(markup).toContain('aria-hidden="true"')
  })
})
