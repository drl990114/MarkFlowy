import { desktopLightTheme } from '@markflowy/theme'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EditorViewType } from 'rme'
import { ServerStyleSheet, StyleSheetManager, ThemeProvider } from 'styled-components'
import { describe, expect, it } from 'vitest'
import { EditorWrapper } from './EditorWrapper'

function renderEditorWrapper({
  $editorViewType = EditorViewType.WYSIWYG,
  $fileType = 'markdown',
  $fullWidth = false,
}: Partial<ComponentProps<typeof EditorWrapper>> = {}) {
  const sheet = new ServerStyleSheet()

  try {
    renderToStaticMarkup(
      <StyleSheetManager sheet={sheet.instance}>
        <ThemeProvider theme={desktopLightTheme}>
          <EditorWrapper
            $editorViewType={$editorViewType}
            $fileType={$fileType}
            $fullWidth={$fullWidth}
            $rootLineHeight='1.7'
            $visible
          />
        </ThemeProvider>
      </StyleSheetManager>,
    )

    return sheet.getStyleTags().replaceAll(/\s/g, '')
  } finally {
    sheet.seal()
  }
}

describe('EditorWrapper reading layout', () => {
  it('sets the Desktop reading column and visual tokens for Markdown', () => {
    const css = renderEditorWrapper()

    expect(css).toContain('--rme-editor-content-width:760px')
    expect(css).toContain('--rme-editor-inline-padding:clamp(20px,5vw,48px)')
    expect(css).toContain('--rme-editor-line-height:1.7')
    expect(css).toContain('--rme-editor-heading-1-size:1.75em')
    expect(css).toContain('--rme-editor-heading-2-size:1.5em')
    expect(css).toContain('--rme-editor-heading-3-size:1.3em')
    expect(css).toContain('--rme-editor-heading-4-size:1.15em')
    expect(css).toContain('--rme-editor-heading-5-size:1.05em')
    expect(css).toContain('--rme-editor-heading-6-size:1em')
    expect(css).toContain(
      'max-width:calc(var(--rme-editor-content-width)+var(--rme-editor-inline-padding)+var(--rme-editor-inline-padding))',
    )
  })

  it.each([
    { $editorViewType: EditorViewType.SOURCECODE },
    { $fileType: 'text' as const },
    { $fullWidth: true },
  ])('keeps source, non-Markdown, and Full Width modes unconstrained', (props) => {
    expect(renderEditorWrapper(props)).toContain('max-width:none')
  })

  it('preserves legacy bottom spacing for Source and non-Markdown surfaces', () => {
    expect(
      renderEditorWrapper({ $editorViewType: EditorViewType.SOURCECODE }),
    ).toContain('padding-bottom:3rem')
    expect(renderEditorWrapper({ $fileType: 'image' })).toContain('padding-bottom:3rem')
    expect(renderEditorWrapper({ $fullWidth: true })).toContain('padding-bottom:0')
  })
})
