import { desktopLightTheme } from '@markflowy/theme'
import { renderToStaticMarkup } from 'react-dom/server'
import { ServerStyleSheet, StyleSheetManager, ThemeProvider } from 'styled-components'
import { describe, expect, it } from 'vitest'
import { Container, EXPLORER_FILE_TREE_INDENT_SIZE, EXPLORER_FILE_TREE_ROW_HEIGHT } from './styles'

function renderExplorerStyles() {
  const sheet = new ServerStyleSheet()

  try {
    renderToStaticMarkup(
      <StyleSheetManager sheet={sheet.instance}>
        <ThemeProvider theme={desktopLightTheme}>
          <Container>
            <div aria-selected='true' className='mf-file-tree-item' role='treeitem'>
              <div data-mf-file-tree-drop-highlight='true' data-mf-file-tree-node=''>
                <div className='mf-file-tree-row'>
                  <span className='file-icon mf-file-tree-icon' />
                  <span>README.md</span>
                  <input className='mf-file-tree-name-input' />
                </div>
              </div>
            </div>
          </Container>
        </ThemeProvider>
      </StyleSheetManager>,
    )

    return sheet.getStyleTags().replaceAll(/\s/g, '')
  } finally {
    sheet.seal()
  }
}

describe('Explorer file tree density', () => {
  it('matches the MarkFlowy project panel type and layout contract', () => {
    const css = renderExplorerStyles()

    expect(EXPLORER_FILE_TREE_ROW_HEIGHT).toBe(26)
    expect(EXPLORER_FILE_TREE_INDENT_SIZE).toBe(20)
    expect(css).toContain('padding:06px')
    expect(css).toContain('border-radius:0')
    expect(css).toContain('font-size:var(--mf-ui-font-body)')
    expect(css).toContain('font-weight:400')
    expect(css).toContain('line-height:var(--mf-line-height)')
    expect(css).toContain('letter-spacing:var(--mf-ui-tracking-body)')
    expect(css).toContain('width:16px;height:16px;line-height:0')
    expect(css).toContain(
      'height:22px;padding:04px;font-size:var(--mf-ui-font-body);line-height:var(--mf-ui-line-height-body)',
    )
  })

  it('paints hover, selection, drop and keyboard focus across the whole row', () => {
    const css = renderExplorerStyles()

    expect(css).toMatch(
      /\.mf-file-tree-item>\[data-mf-file-tree-node\]\{[^}]*width:100%;[^}]*align-items:stretch;[^}]*border-right-width:2px;[^}]*background-color:transparent/,
    )
    expect(css).toMatch(
      /\.mf-file-tree-item>\[data-mf-file-tree-node\]>\.mf-file-tree-row\{background-color:transparent/,
    )
    expect(css).toMatch(
      /\.mf-file-tree-item:hover>\[data-mf-file-tree-node\]\{background-color:var\(--mf-ui-control-hover-bg/,
    )
    expect(css).toMatch(
      /\.mf-file-tree-item:focus-visible>\[data-mf-file-tree-node\]\{border-color:var\(--mf-control-focus/,
    )
    expect(css).toMatch(
      /\[data-mf-file-tree-node\]\[data-mf-file-tree-drop-highlight='true'\]\{background-color:var\(--mf-primary-soft/,
    )
    expect(css).toMatch(
      /\.mf-file-tree-item\[aria-selected='true'\]>\[data-mf-file-tree-node\].*background-color:var\(--mf-ui-control-hover-bg/,
    )
    expect(css.indexOf('--mf-primary-soft')).toBeGreaterThan(
      css.lastIndexOf('--mf-ui-control-hover-bg'),
    )
  })
})
