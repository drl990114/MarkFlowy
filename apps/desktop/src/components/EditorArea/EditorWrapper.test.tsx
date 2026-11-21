import { desktopLightTheme } from '@markflowy/theme'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EditorViewType } from 'rme'
import { ServerStyleSheet, StyleSheetManager, ThemeProvider } from 'styled-components'
import { describe, expect, it } from 'vitest'
import { EditorWrapper } from './EditorWrapper'
import { getEditorContentWidth } from '@/constants/editorWidth'

function renderEditorWrapper({
  $editorViewType = EditorViewType.WYSIWYG,
  $fileType = 'markdown',
  $contentWidth = getEditorContentWidth({}),
}: Partial<ComponentProps<typeof EditorWrapper>> = {}) {
  const sheet = new ServerStyleSheet()

  try {
    const markup = renderToStaticMarkup(
      <StyleSheetManager sheet={sheet.instance}>
        <ThemeProvider theme={desktopLightTheme}>
          <EditorWrapper
            $editorViewType={$editorViewType}
            $fileType={$fileType}
            $contentWidth={$contentWidth}
            $rootLineHeight='1.7'
            $visible
          />
        </ThemeProvider>
      </StyleSheetManager>,
    )

    return (markup + sheet.getStyleTags()).replaceAll(/\s/g, '')
  } finally {
    sheet.seal()
  }
}

describe('EditorWrapper reading layout', () => {
  it.each([EditorViewType.WYSIWYG, EditorViewType.PREVIEW])(
    'sets the Desktop reading column and visual tokens for Markdown %s',
    ($editorViewType) => {
      const css = renderEditorWrapper({ $editorViewType })

      expect(css).toContain('--mf-reader-content-width:760px')
      expect(css).toContain('--rme-editor-content-width:var(--mf-reader-content-width)')
      expect(css).toContain('--rme-editor-inline-padding:clamp(20px,5vw,48px)')
      expect(css).toContain('--mf-capricorn-inline-padding:68px')
      expect(css).toContain('--cap-editor-inline-padding:var(--mf-capricorn-inline-padding)')
      expect(css).toContain('--cap-editor-block-padding-start:24px')
      expect(css).toContain('--rme-editor-line-height:1.7')
      expect(css).toContain('--rme-editor-blockquote-color:var(--mf-theme-editor-muted)')
      expect(css).toContain('--rme-editor-inline-code-bg:var(--mf-theme-editor-code-background)')
      expect(css).toContain(
        '--rme-editor-selection-foreground:var(--mf-theme-editor-selection-foreground)',
      )
      expect(css).toContain('--rme-editor-heading-1-size:1.75em')
      expect(css).toContain('--rme-editor-heading-2-size:1.5em')
      expect(css).toContain('--rme-editor-heading-3-size:1.3em')
      expect(css).toContain('--rme-editor-heading-4-size:1.15em')
      expect(css).toContain('--rme-editor-heading-5-size:1.05em')
      expect(css).toContain('--rme-editor-heading-6-size:1em')
      expect(css).toContain(
        'max-width:calc(var(--rme-editor-content-width)+var(--mf-capricorn-inline-padding)+var(--mf-capricorn-inline-padding))',
      )
    },
  )

  it.each([
    [{ editor_width_mode: 'fixed', editor_fixed_width: 813 }, '813px'],
    [{ editor_width_mode: 'fixed', editor_fixed_width: 1601 }, '760px'],
    [{ editor_width_mode: 'full', editor_fixed_width: 813 }, '100%'],
    [{ editor_width_mode: 'theme', editor_fixed_width: 813 }, 'var(--mf-theme-editor-content-width,760px)'],
    [{ editor_full_width: true }, '100%'],
    [{ editor_full_width: false }, 'var(--mf-theme-editor-content-width,760px)'],
  ] as const)('applies the reading preference %o to the shared column', (settings, expected) => {
    expect(renderEditorWrapper({ $contentWidth: getEditorContentWidth(settings) }))
      .toContain(`--mf-reader-content-width:${expected}`)
  })

  it.each([
    { $editorViewType: EditorViewType.SOURCECODE },
    { $fileType: 'text' as const },
    { $contentWidth: '100%' },
  ])('keeps source, non-Markdown, and Full Width modes unconstrained', (props) => {
    expect(renderEditorWrapper(props)).toContain('max-width:none')
  })

  it('preserves legacy bottom spacing for Source and non-Markdown surfaces', () => {
    expect(renderEditorWrapper({ $editorViewType: EditorViewType.SOURCECODE })).toContain(
      'padding-bottom:3rem',
    )
    expect(renderEditorWrapper({ $fileType: 'image' })).toContain('padding-bottom:3rem')
    expect(renderEditorWrapper({ $contentWidth: '100%' })).toContain('padding-bottom:0')
  })
})
