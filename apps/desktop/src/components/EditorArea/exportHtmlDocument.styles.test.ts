import { afterEach, describe, expect, it, vi } from 'vitest'
import { getExportableImageSrc } from '@/helper/image'
import { exportHtmlDocument } from './exportHtmlDocument'

vi.mock('@/helper/image', () => ({ getExportableImageSrc: vi.fn() }))

const cleanups: (() => void)[] = []
const imageData = 'data:image/png;base64,aGVsbG8='

afterEach(() => {
  cleanups.splice(0).reverse().forEach((cleanup) => cleanup())
  vi.restoreAllMocks()
  vi.mocked(getExportableImageSrc).mockReset()
})

function createRoot(html = '<p>Portable document</p>') {
  const root = document.createElement('div')
  root.className = 'export-styles-fixture'
  root.innerHTML = html
  document.body.append(root)
  cleanups.push(() => root.remove())
  return root
}

function createSheet() {
  const style = document.createElement('style')
  style.dataset.styled = 'active'
  document.head.append(style)
  cleanups.push(() => style.remove())
  return { style, sheet: style.sheet! }
}

const parseExport = (html: string) => new DOMParser().parseFromString(html, 'text/html')

describe('portable HTML styles', () => {
  it('reads CSSOM-only styled rules and selects document rules across multiple sheets', async () => {
    const root = createRoot('<p><strong>Text</strong></p>')
    const first = createSheet()
    first.sheet.insertRule('.export-styles-fixture strong { color: rgb(10, 20, 30); }')
    const second = createSheet()
    second.sheet.insertRule('.export-styles-fixture p, .unrelated-app-panel { margin-top: 8px; }')
    second.sheet.insertRule('.unrelated-app-panel { background-image: url("private-host-image.png"); }')
    second.sheet.insertRule('@font-face { font-family: HostOnly; src: url("private-host-font.woff2"); }')
    expect(first.style.textContent).toBe('')
    expect(second.style.textContent).toBe('')

    const exported = parseExport(await exportHtmlDocument(root.innerHTML, root, 'Notes'))
    const css = exported.head.querySelector('style')!.textContent!
    expect(css).toContain('.export-styles-fixture strong')
    expect(css).toContain('rgb(10, 20, 30)')
    expect(css).toContain('.export-styles-fixture p')
    expect(css).toMatch(/margin-top:\s*8px/)
    expect(css).not.toMatch(/unrelated-app-panel|private-host|@font-face/)
    expect(getExportableImageSrc).not.toHaveBeenCalled()
  })

  it('preserves layer declarations and nested matching rules without reading a statement as a group', async () => {
    const root = createRoot()
    const { sheet } = createSheet()
    sheet.insertRule('@media print { .export-styles-fixture p { color: rgb(30, 40, 50); } .unrelated-app-panel { display: none; } }')
    const nestedRules = Array.from(sheet.cssRules)
    // happy-dom has no CSSLayerStatementRule/CSSLayerBlockRule yet. Model the
    // native CSSOM shape; declarations deliberately have no cssRules member.
    Object.defineProperty(sheet, 'cssRules', {
      configurable: true,
      value: [
        { type: 0, cssText: '@layer theme, base, components, mf-components, utilities;' },
        { type: 0, cssText: '@layer mf-components { }', cssRules: nestedRules },
      ],
    })

    const exported = parseExport(await exportHtmlDocument(root.innerHTML, root, 'Notes'))
    const css = exported.head.querySelector('style')!.textContent!
    expect(css).toContain('@layer theme, base, components, mf-components, utilities;')
    expect(css).toMatch(/@layer mf-components\s*\{\s*@media print\s*\{/)
    expect(css).toContain('.export-styles-fixture p')
    expect(css).toContain('rgb(30, 40, 50)')
    expect(css).not.toContain('unrelated-app-panel')
  })

  it('retains the used inherited variables and embeds URLs reached through those variables', async () => {
    const root = createRoot()
    const previous = document.body.style.cssText
    document.body.style.setProperty('--export-ink', '#234567')
    document.body.style.setProperty('--export-color', 'var(--export-ink)')
    document.body.style.setProperty('--export-image', 'url("asset://localhost/notes/icon.png")')
    document.body.style.setProperty('--unrelated-host-setting', 'private-host-value')
    cleanups.push(() => { document.body.style.cssText = previous })
    // happy-dom omits inherited custom properties from getComputedStyle. Supply
    // the browser's inherited values while leaving CSSOM parsing/serialization real.
    const computedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
      element === root ? document.body.style : computedStyle(element),
    )
    const { sheet } = createSheet()
    sheet.insertRule('.export-styles-fixture p { color: var(--export-color); background-image: var(--export-image); }')
    vi.mocked(getExportableImageSrc).mockResolvedValue(imageData)

    const exported = parseExport(await exportHtmlDocument(root.innerHTML, root, 'Notes', '/notes'))
    const exportedRoot = exported.querySelector<HTMLElement>('.mf-html-export')!
    expect(exportedRoot.style.getPropertyValue('--export-color')).toMatch(/#234567|var\(--export-ink\)/)
    if (exportedRoot.style.getPropertyValue('--export-color').includes('var('))
      expect(exportedRoot.style.getPropertyValue('--export-ink')).toBe('#234567')
    expect(exportedRoot.style.getPropertyValue('--export-image')).toContain(imageData)
    expect(exportedRoot.outerHTML).not.toMatch(/asset:\/\/|private-host-value|--unrelated-host-setting/)
    expect(getExportableImageSrc).toHaveBeenCalledWith('asset://localhost/notes/icon.png', '/notes', undefined)
    expect(root.style.getPropertyValue('--export-image')).toBe('')
  })

  it('escapes closing style text from CSSOM rules when serializing the standalone document', async () => {
    const root = createRoot()
    const { sheet } = createSheet()
    sheet.insertRule('.export-styles-fixture p::before { content: "</style><script id=export-injection>bad()</script>"; }')

    const html = await exportHtmlDocument(root.innerHTML, root, 'Notes')
    const exported = parseExport(html)
    expect(exported.querySelector('script')).toBeNull()
    expect(exported.head.querySelector('style')!.textContent).toContain('<\\/style>')
    expect(exported.querySelector('.mf-html-export p')!.textContent).toBe('Portable document')
  })
})
