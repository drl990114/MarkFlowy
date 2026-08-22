import { desktopLightTheme } from '@markflowy/theme'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ServerStyleSheet, ThemeProvider } from 'styled-components'
import { describe, expect, it } from 'vitest'
import { getNextTabIndex } from './EditorAreaTabs'
import { TabItem } from './styles'

function getTabStyles(active: boolean) {
  const sheet = new ServerStyleSheet()
  const theme = {
    ...desktopLightTheme,
    editorTabActiveBgColor: '#abcdef',
    editorTabBgColor: '#fedcba',
  }

  try {
    renderToStaticMarkup(
      sheet.collectStyles(
        createElement(
          ThemeProvider,
          { theme },
          createElement(TabItem, { $active: active }, 'Tab'),
        ),
      ),
    )
    return sheet.getStyleTags()
  } finally {
    sheet.seal()
  }
}

describe('getNextTabIndex', () => {
  it('wraps arrow navigation across the tab list', () => {
    expect(getNextTabIndex(0, 3, 'ArrowLeft')).toBe(2)
    expect(getNextTabIndex(2, 3, 'ArrowRight')).toBe(0)
    expect(getNextTabIndex(1, 3, 'ArrowLeft')).toBe(0)
    expect(getNextTabIndex(1, 3, 'ArrowRight')).toBe(2)
  })

  it('moves directly to the first or last tab', () => {
    expect(getNextTabIndex(1, 3, 'Home')).toBe(0)
    expect(getNextTabIndex(1, 3, 'End')).toBe(2)
  })

  it('returns no target for an invalid list position', () => {
    expect(getNextTabIndex(0, 0, 'ArrowRight')).toBe(-1)
    expect(getNextTabIndex(-1, 3, 'ArrowRight')).toBe(-1)
  })

  it('uses the dedicated active and inactive tab surfaces', () => {
    expect(getTabStyles(true)).toContain('background-color:#abcdef')
    expect(getTabStyles(false)).toContain('background-color:#fedcba')
  })
})
