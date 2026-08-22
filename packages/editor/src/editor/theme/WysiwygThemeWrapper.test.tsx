import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ServerStyleSheet, StyleSheetManager, ThemeProvider } from 'styled-components'
import { lightTheme } from './index'
import { WysiwygThemeWrapper } from './WysiwygThemeWrapper'

function renderWrapperStyles() {
  const sheet = new ServerStyleSheet()

  try {
    renderToStaticMarkup(
      <StyleSheetManager sheet={sheet.instance}>
        <ThemeProvider theme={lightTheme.styledConstants}>
          <WysiwygThemeWrapper>Content</WysiwygThemeWrapper>
        </ThemeProvider>
      </StyleSheetManager>,
    )

    return sheet.getStyleTags().replaceAll(/\s/g, '')
  } finally {
    sheet.seal()
  }
}

describe('WysiwygThemeWrapper visual overrides', () => {
  it('keeps the existing editor values as fallbacks when host variables are absent', () => {
    const css = renderWrapperStyles()

    expect(css).toContain('var(--rme-editor-block-padding-start,0)')
    expect(css).toContain('var(--rme-editor-block-padding-end,1em)')
    expect(css).toContain('var(--rme-editor-line-height,1.6)')
    expect(css).toContain('var(--rme-editor-heading-1-size,1.875em)')
    expect(css).toContain('var(--rme-editor-code-block-radius,6px)')
    expect(css).toContain('var(--rme-editor-table-cell-padding-inline,20px)')
    expect(css).toMatch(/code,[^{]*tt\{[^}]*font-size:0\.9em/)
    expect(css).toMatch(/pre\{[^}]*font-size:0\.9em/)
    expect(css).toMatch(/\.cm-editor[^}]*\.cm-line\{[^}]*font-size:1em/)
    expect(css).toMatch(/\.mf-live-preview-language\{[^}]*font-size:12px/)
  })

  it('removes only a document-leading heading margin in editor and preview content', () => {
    const css = renderWrapperStyles()

    expect(css).toMatch(
      /\.remirror-editor>:is\(h1,h2,h3,h4,h5,h6\):first-child,[^{]*\.mf-preview-content>:is\(h1,h2,h3,h4,h5,h6\):first-child\{margin-top:0!important/,
    )
    expect(css).not.toContain('.remirror-editor>:first-child')
    expect(css).toMatch(
      /h1\{[^}]*margin:var\(--rme-editor-heading-margin-block-start/,
    )
  })

  it('uses a soft node-selection halo instead of competing with node borders', () => {
    const css = renderWrapperStyles()

    expect(css).toContain(
      'ProseMirror-selectednode{outline:none;box-shadow:0003pxvar(--rme-editor-selection-halo,var(--rme-editor-selection-bg',
    )
    expect(css).toMatch(
      /\.md-image-node-view-wrapper\.ProseMirror-selectednode\{background-color:transparent/,
    )
    expect(css).toContain(
      'mf-live-preview-selected{box-shadow:0003pxvar(--rme-editor-selection-halo,var(--rme-editor-selection-bg',
    )
    expect(css).not.toContain('--rme-editor-image-selection-outline')
  })
})
