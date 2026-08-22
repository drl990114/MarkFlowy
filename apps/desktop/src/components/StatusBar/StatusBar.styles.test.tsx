import { desktopLightTheme } from '@markflowy/theme'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { ServerStyleSheet, StyleSheetManager, ThemeProvider } from 'styled-components'
import { describe, expect, it } from 'vitest'
import { Container, LeftContainer, RightContainer, StatusBarSeparator } from './styled'

const desktopUiStyles = readFileSync(resolve(process.cwd(), 'src/ui.css'), 'utf8')

function renderStatusBarStyles() {
  const sheet = new ServerStyleSheet()

  try {
    renderToStaticMarkup(
      <StyleSheetManager sheet={sheet.instance}>
        <ThemeProvider theme={desktopLightTheme}>
          <Container>
            <LeftContainer />
            <RightContainer>
              <div role='status'>
                <svg aria-hidden='true' />
                <span>Task</span>
              </div>
            </RightContainer>
            <StatusBarSeparator />
          </Container>
        </ThemeProvider>
      </StyleSheetManager>,
    )

    return sheet.getStyleTags()
  } finally {
    sheet.seal()
  }
}

describe('StatusBar responsive density', () => {
  it('matches the existing 32px top chrome while only clipping at the outer page boundary', () => {
    const css = renderStatusBarStyles().replaceAll(/\s/g, '')

    expect(desktopUiStyles).toContain('--mf-ui-status-bar-height: 32px')
    expect(desktopUiStyles).toContain('--color-surface-statusbar: var(--mf-surface-statusbar)')
    expect(desktopUiStyles).not.toContain('--mf-ui-status-bar-height: 36px')
    expect(css).toContain('height:var(--mf-ui-status-bar-height)')
    expect(css).toContain('background:var(--mf-surface-statusbar)')
    expect(css).toContain('padding:4px6px5px')
    expect(css).toContain('height:22px')
    expect(css.match(/overflow:hidden/g)).toHaveLength(1)
    expect(css).toContain('flex:11auto')
  })

  it('raises narrow-window hit targets to 24px and compresses only spacing', () => {
    const rawCss = renderStatusBarStyles()
    const css = rawCss.replaceAll(/\s/g, '')

    expect(css).toContain('@media(max-width:719px)')
    expect(css).toContain('height:24px;min-width:24px')
    expect(css).toContain('@media(max-width:299px)')
    expect(css).toContain('@media(max-width:229px)')
    expect(css).toContain('padding:3px2px4px')
    expect(css).not.toContain('height:20px')
    expect(css).not.toContain('min-width:20px')
    expect(css).not.toContain('width:20px')
    expect(rawCss).toMatch(/\.[\w-]+ \[data-mf-status-bar-button\]\s*\{\s*height:\s*24px/)
    expect(rawCss).toMatch(
      /\.[\w-]+ \[data-mf-status-bar-format='icon'\]\s*\{\s*width:\s*24px/,
    )

    // 3 left Dock buttons + overflow + task icon + Zen + 2 right Dock buttons,
    // including the declared gaps and horizontal padding at each density tier.
    const mediumDensityWidth =
      5 * 24 + 3 + 24 + 18 + 24 + 2 + 2 * 2 + 3 * 2 + 8 + 2
    const narrowDensityWidth = 5 * 24 + 24 + 14 + 24 + 1 + 2 + 4 + 1

    expect(mediumDensityWidth).toBe(211)
    expect(mediumDensityWidth).toBeLessThanOrEqual(230)
    expect(narrowDensityWidth).toBe(190)
    expect(narrowDensityWidth).toBeLessThanOrEqual(200)
  })

  it('keeps Dock states subtle and reserves accent for the selected icon', () => {
    const css = renderStatusBarStyles().replaceAll(/\s/g, '')

    expect(css).toContain('.mf-dock-switcher__button{color:var(--mf-text-secondary);}')
    expect(css).toContain('.mf-dock-switcher__button:hover')
    expect(css).toContain('color:var(--mf-text-primary)')
    expect(css).toContain(
      ".mf-dock-switcher__button[aria-pressed='true']>svg{color:var(--mf-primary);}",
    )
  })

  it('collapses task copy to its status icon and only hides separators at the narrowest tier', () => {
    const css = renderStatusBarStyles().replaceAll(/\s/g, '')

    expect(css).toContain('@media(max-width:399px)')
    expect(css).toContain(">[role='status']>span{display:none;}")
    expect(css).toContain('@media(max-width:229px)')
    expect(css).toMatch(/@media\(max-width:229px\)\{\.[\w-]+\{display:none;\}\}/)
  })
})
