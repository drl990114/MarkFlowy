import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { scopePdfViewerCss } from './pdfPreviewAssets'

describe('PDF viewer stylesheet isolation', () => {
  it('scopes root and top-level selectors, preserving nested selectors and keyframes', () => {
    const css = scopePdfViewerCss(
      ':root {--icon:url(images/icon.svg)} .page { & > .text {color:red} } @media screen { :root {--width:1} .page {width:1px} } @keyframes fade {from{opacity:0}to{opacity:1}}',
    )
    expect(css).toContain('.mf-pdf-preview {--icon:url(/mf-pdf-assets/images/icon.svg)}')
    expect(css).toContain('.mf-pdf-preview .page { & > .text')
    expect(css).not.toContain('.mf-pdf-preview from')
    expect(css).not.toContain(':root')
  })
  it('processes the installed PDF.js stylesheet and rewrites packaged image resources', () => {
    const require = createRequire(import.meta.url)
    const css = scopePdfViewerCss(
      readFileSync(require.resolve('pdfjs-dist/web/pdf_viewer.css'), 'utf8'),
    )
    expect(css).not.toContain(':root')
    expect(css).toContain('/mf-pdf-assets/images/loading-icon.gif')
    expect(css).toContain('.mf-pdf-preview .pdfViewer')
  })
  it('keeps PDF page dimensions independent of the Desktop border-box reset', () => {
    const require = createRequire(import.meta.url)
    const stylesheet = document.createElement('style')
    const fixture = document.createElement('div')
    stylesheet.textContent =
      '[data-slot], [data-slot] * { box-sizing: border-box; }' +
      scopePdfViewerCss(readFileSync(require.resolve('pdfjs-dist/web/pdf_viewer.css'), 'utf8'))
    fixture.innerHTML = `
      <div class="mf-pdf-preview" data-slot="pdf-preview">
        <button>Toolbar</button>
        <div class="pdfViewer">
          <div class="page">
            <div class="annotationLayer"><section></section></div>
            <div class="xfaLayer"><span></span></div>
          </div>
        </div>
      </div>
      <div class="page" data-slot="unrelated"></div>`
    document.head.append(stylesheet)
    document.body.append(fixture)
    try {
      const boxSizing = (selector: string) =>
        getComputedStyle(fixture.querySelector(selector)!).boxSizing
      expect(boxSizing('.pdfViewer .page')).toBe('content-box')
      expect(boxSizing('button')).toBe('border-box')
      expect(boxSizing('.annotationLayer section')).toBe('border-box')
      expect(boxSizing('.xfaLayer span')).toBe('border-box')
      expect(boxSizing('[data-slot="unrelated"]')).toBe('border-box')
    } finally {
      fixture.remove()
      stylesheet.remove()
    }
  })
})
