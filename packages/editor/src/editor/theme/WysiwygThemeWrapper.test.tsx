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
    expect(css).toMatch(/h1\{[^}]*margin:var\(--rme-editor-heading-margin-block-start/)
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

  it('uses one spacing contract for task, nested, tight, and loose lists', () => {
    const css = renderWrapperStyles()

    expect(css).toContain('--rme-list-item-gap:0.25em')
    expect(css).toContain('--rme-loose-list-item-gap:0.75em')
    expect(css).toContain('--rme-nested-list-gap:0.25em')
    expect(css).toContain("[data-tight='true']>li+li{margin-top:var(--rme-list-item-gap)")
    expect(css).toContain("[data-tight='false']>li+li{margin-top:var(--rme-loose-list-item-gap)")
    expect(css).not.toMatch(/li>p\{margin-top:16px/)
  })

  it('gives task items a compact checkbox and a muted completed state', () => {
    const css = renderWrapperStyles()

    expect(css).toContain('--rme-task-checkbox-size:1em')
    expect(css).toContain('--rme-task-checkbox-foreground:var(--mf-primary-foreground,#fff)')
    expect(css).toContain(
      'li[data-checked]{display:grid;grid-template-columns:var(--rme-task-checkbox-size)minmax(0,1fr);column-gap:0.5em;margin-left:-1.5em',
    )
    expect(css).toContain(
      'li[data-checked]>[data-rme-task-checkbox-control]{display:flex;align-items:center;justify-content:center;width:var(--rme-task-checkbox-size);height:1lh',
    )
    expect(css).toContain(
      'li[data-checked]>[data-rme-task-checkbox-control]>input[data-rme-task-checkbox]{flex:none',
    )
    expect(css).toContain('width:var(--rme-task-checkbox-size)')
    expect(css).toContain('border:1.5pxsolid#9ca3af')
    expect(css).toContain('border:solidvar(--rme-task-checkbox-foreground)')
    expect(css).toContain('border-width:00calc(0.1em+1px)calc(0.1em+1px)')
    expect(css).toContain(
      "li[data-checked='true']>[data-rme-list-item-content]>:first-child{color:#9ca3af;text-decoration:line-through",
    )
  })

  it('draws a themed nesting guide without changing list indentation', () => {
    const css = renderWrapperStyles()

    expect(css).toContain('--rme-nested-list-guide-offset:1em')
    expect(css).toContain('--rme-bullet-list-guide-offset:0.9em')
    expect(css).toContain('ul>li:not([data-checked])>:is(ul,ol),')
    expect(css).toContain(
      '--rme-nested-list-guide-offset:var(--rme-bullet-list-guide-offset)',
    )
    expect(css).toContain(':is(ul,ol):is(ul,ol)::before{position:absolute')
    expect(css).toContain('left:calc(-1*var(--rme-nested-list-guide-offset))')
    expect(css).toContain('background:color-mix(insrgb,#d7d7dc72%,transparent)')
  })
})
