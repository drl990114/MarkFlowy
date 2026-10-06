import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getExportableImageSrc } from '@/helper/image'
import { FileResultCode } from '@markflowy/interface'
import { invoke } from '@tauri-apps/api/core'
import { buildPdfExportDocument, PDF_EXPORT_CSP } from './pdfExportDocument'

vi.mock('@/helper/image', () => ({ getExportableImageSrc: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

const cleanups: (() => void)[] = []
const png = 'data:image/png;base64,aW1hZ2U='
const fontBytes = new Uint8Array([119, 79, 70, 50, 0, 0, 0, 0])
const fontBase64 = btoa(String.fromCharCode(...fontBytes))
const fontData = `data:font/woff2;base64,${fontBase64}`

beforeEach(() => {
  vi.mocked(getExportableImageSrc)
    .mockReset()
    .mockImplementation(async (source) => source)
  vi.mocked(invoke).mockReset()
})
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function createRoot(html = '<h1>文档</h1><p>内容</p>') {
  const outer = document.createElement('div')
  outer.className = 'mf-pdf-print-root'
  outer.setAttribute('aria-hidden', 'true')
  outer.setAttribute('inert', '')
  outer.setAttribute('hidden', '')
  outer.setAttribute('data-mf-pdf-print-root', '')
  outer.innerHTML = `<div class="mf-preview-content">${html}</div>`
  document.body.append(outer)
  cleanups.push(() => outer.remove())
  return outer
}

function createSheet(rules: string[], href?: string) {
  const style = document.createElement('style')
  document.head.append(style)
  cleanups.push(() => style.remove())
  for (const rule of rules) style.sheet!.insertRule(rule, style.sheet!.cssRules.length)
  if (href) Object.defineProperty(style.sheet!, 'href', { configurable: true, value: href })
  return style.sheet!
}

async function prepare(
  root: HTMLElement,
  overrides: Partial<Parameters<typeof buildPdfExportDocument>[0]> = {},
) {
  return buildPdfExportDocument({
    root,
    html: root.querySelector('.mf-preview-content')?.innerHTML || root.innerHTML,
    title: '文档 <notes & "quotes">',
    paperSize: 'a4',
    landscape: false,
    ...overrides,
  })
}
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')

describe('standalone PDF document', () => {
  it('keeps heading semantics, skipped levels and unique CJK/duplicate anchors without changing the prepared preview', async () => {
    const root = createRoot(
      '<h1>中文标题</h1><h3>同名</h3><h3>同名</h3><h6>末节 ✨</h6><h2 id="custom">自定义</h2><a href="#中文标题">跳转</a>',
    )
    root.style.cssText = 'position:fixed;left:-100000px;visibility:hidden'
    const before = root.outerHTML
    const { html, headingCount } = await prepare(root)
    const exported = parse(html)
    expect(
      [...exported.querySelectorAll('h1,h2,h3,h6')].map((heading) => [heading.tagName, heading.id]),
    ).toEqual([
      ['H1', '中文标题'],
      ['H3', '同名'],
      ['H3', '同名-1'],
      ['H6', '末节-'],
      ['H2', 'custom'],
    ])
    expect(exported.querySelector('#custom > span')?.id).toBe('自定义')
    expect(headingCount).toBe(5)
    expect(exported.title).toBe('文档 <notes & "quotes">')
    expect(exported.body.innerHTML).not.toMatch(
      /mf-pdf-print-root|aria-hidden|inert|hidden=|-100000px/,
    )
    expect(root.outerHTML).toBe(before)
  })

  it.each([
    ['a4', false, 'A4 portrait'],
    ['a4', true, 'A4 landscape'],
    ['letter', false, 'LETTER portrait'],
    ['letter', true, 'LETTER landscape'],
  ] as const)(
    'owns %s paper dimensions and landscape=%s without reading padding',
    async (paperSize, landscape, size) => {
      const root = createRoot(
        '<h1>分页</h1><table><thead><tr><th>列</th></tr></thead><tbody><tr><td>数据</td></tr></tbody></table><pre><code>long code</code></pre>',
      )
      createSheet([
        '.mf-pdf-print-root { position: fixed; left: -100000px; visibility: hidden; }',
        '.mf-pdf-print-root .mf-preview-content { padding: 40px; overflow: hidden; }',
        '@media print { .mf-pdf-print-root h1 { break-after: avoid-page; } }',
      ])
      const { html } = await prepare(root, { paperSize, landscape })
      const css = parse(html).head.querySelector('style')!.textContent!
      expect(css).toContain(`@page{size:${size};margin:16mm}`)
      expect(css).not.toMatch(/clamp\(|mf-html-export|mf-pdf-print-root|A5|-100000px/)
      expect(css).toContain('padding:0!important')
      expect(css).toContain('.mf-pdf-export .mf-preview-content')
      expect(css).toContain('table-header-group')
      expect(css).toContain('white-space:pre-wrap!important')
      expect(css).toContain('break-inside:auto')
      expect(css).toContain('@media print')
    },
  )

  it('removes executable content and event attributes and freezes a restrictive CSP', async () => {
    const root = createRoot()
    root.setAttribute('onclick', 'steal()')
    const { html } = await prepare(root, {
      html: '<h1 role="presentation" aria-level="9" onclick="steal()">安全</h1><script>steal()</script><iframe src="https://evil.invalid"></iframe><img src="data:image/png;base64,aW1hZ2U=" onerror="steal()"><svg onload="steal()"><script>steal()</script><path id="shape"/><use href="#shape"/></svg><a href="javascript:steal()" ping="https://evil.invalid">link</a><style>@import "https://evil.invalid/style.css";@page{size:A5;margin:0}.note{color:inherit}</style>',
    })
    const exported = parse(html)
    expect(
      exported.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content'),
    ).toBe(PDF_EXPORT_CSP)
    expect(exported.querySelector('h1')?.getAttribute('role')).toBe('presentation')
    expect(exported.querySelector('h1')?.getAttribute('aria-level')).toBe('9')
    expect(html).not.toMatch(
      /steal\(|javascript:|evil\.invalid|@import|A5|onclick|onerror|onload|<script|<iframe/,
    )
    expect(exported.querySelector('use')?.getAttribute('href')).toBe('#shape')
  })

  it('retains authored hidden and decorative semantics and excludes collapsed details from the preliminary heading count', async () => {
    const root = createRoot(
      [
        '<h1>可见标题</h1><span aria-hidden="true">装饰文字</span>',
        '<section aria-hidden="true"><h2>辅助隐藏标题</h2></section>',
        '<section inert><h2>非交互标题</h2></section><h2 hidden>隐藏标题</h2>',
        '<details><summary><h3>摘要标题</h3></summary><h4>折叠正文标题</h4></details>',
        '<details open><summary>展开摘要</summary><h5>展开正文标题</h5></details>',
        '<h6 role="presentation" aria-level="2">装饰标题</h6>',
      ].join(''),
    )
    const before = root.outerHTML
    const { html, headingCount } = await prepare(root)
    const exported = parse(html)
    expect(headingCount).toBe(3)
    expect(exported.querySelector('span[aria-hidden="true"]')?.textContent).toBe('装饰文字')
    expect(exported.querySelector('section[aria-hidden="true"] h2')?.textContent).toBe(
      '辅助隐藏标题',
    )
    expect(exported.querySelector('section[inert] h2')?.textContent).toBe('非交互标题')
    expect(exported.querySelector('h2[hidden]')?.textContent).toBe('隐藏标题')
    expect(exported.querySelector('details:not([open]) h4')?.textContent).toBe('折叠正文标题')
    expect(exported.querySelector('h6')?.getAttribute('role')).toBe('presentation')
    expect(exported.querySelector('h6')?.getAttribute('aria-level')).toBe('2')
    const exportedPreview = exported.querySelector('.mf-preview-content')!
    expect(exportedPreview.hasAttribute('inert')).toBe(false)
    expect(exportedPreview.hasAttribute('aria-hidden')).toBe(false)
    expect(exportedPreview.hasAttribute('hidden')).toBe(false)
    expect(root.outerHTML).toBe(before)
  })

  it('preserves RME styled ancestor scopes and inherited typography without its offscreen geometry', async () => {
    const root = createRoot(
      '<h1>عنوان</h1><p>نص</p><table><tbody><tr><td>جدول</td></tr></tbody></table>',
    )
    const preview = root.querySelector<HTMLElement>('.mf-preview-content')!
    const wrapper = document.createElement('div')
    wrapper.className = 'sc-rme-theme sc-print-theme'
    wrapper.setAttribute('dir', 'rtl')
    wrapper.setAttribute('inert', '')
    wrapper.setAttribute('aria-hidden', 'true')
    wrapper.style.cssText =
      'position:fixed;left:-100000px;height:800px;overflow:hidden;padding:40px'
    preview.replaceWith(wrapper)
    wrapper.append(preview)
    createSheet([
      '.sc-rme-theme { font-family: serif; font-size: 18px; line-height: 1.6; direction: rtl; text-align: right; }',
      '.sc-rme-theme h1 { font-size: 32px; font-weight: 700; }',
      '.sc-rme-theme .mf-preview-content td { padding: 6px; }',
    ])
    const computed = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
      element === preview ? computed(wrapper) : computed(element),
    )
    const before = root.outerHTML
    const { html } = await prepare(root)
    const exported = parse(html)
    const exportedWrapper = exported.querySelector<HTMLElement>('.mf-pdf-export-wrapper')!
    expect(exportedWrapper.classList.contains('sc-rme-theme')).toBe(true)
    expect(exportedWrapper.getAttribute('dir')).toBe('rtl')
    expect(exportedWrapper.querySelector('.mf-preview-content h1')?.textContent).toBe('عنوان')
    expect(exportedWrapper.outerHTML).not.toMatch(
      /-100000px|height: 800px|hidden|inert|padding: 40px/,
    )
    const css = exported.head.querySelector('style')!.textContent!
    expect(css).toContain('.sc-rme-theme{')
    expect(css).toContain('.sc-rme-theme h1{')
    expect(css).toContain('.sc-rme-theme .mf-preview-content td{')
    expect(css).toContain('.mf-pdf-export-wrapper')
    const exportedPreview = exported.querySelector<HTMLElement>('.mf-preview-content')!
    expect(exportedPreview.style.fontSize).toBe('18px')
    expect(exportedPreview.style.getPropertyValue('direction')).toBe('rtl')
    expect(exportedPreview.style.textAlign).toBe('right')
    expect(root.outerHTML).toBe(before)
  })

  it('embeds used CSSOM fonts relative to their stylesheet and ignores unrelated font faces', async () => {
    const root = createRoot('<h1>数学</h1><span class="math">公式</span>')
    const stylesheet = new URL('/assets/export.css', document.baseURI).href
    const fontUrl = new URL('/assets/fonts/KaTeX_Main.woff2', document.baseURI).href
    createSheet(
      [
        '.mf-preview-content .math { font-family: KaTeX_Main; }',
        '@font-face { font-family: KaTeX_Main; font-weight: 400; src: url("fonts/KaTeX_Main.woff2") format("woff2"), url("fonts/KaTeX_Main.woff") format("woff"); }',
        '@font-face { font-family: Unused; src: url("https://private.invalid/font.woff2"); }',
      ],
      stylesheet,
    )
    const fetcher = vi.fn(async () => ({ ok: true, arrayBuffer: async () => fontBytes.buffer }))
    vi.stubGlobal('fetch', fetcher)
    const { html } = await prepare(root)
    const css = parse(html).head.querySelector('style')!.textContent!
    expect(css).toContain('@font-face')
    expect(css).toContain(fontData)
    expect(css).toMatch(/font-weight:\s*400/)
    expect(css).not.toMatch(/Unused|private\.invalid|fonts\/KaTeX|url\("fonts/)
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(fontUrl)
    expect(getExportableImageSrc).not.toHaveBeenCalled()
  })

  it.each([
    'blob:retained-font',
    'asset://localhost/%2Fnotes%2Ffont.woff2',
    'file:///notes/font.woff2',
  ])('embeds the retained/native font %s', async (source) => {
    const root = createRoot('<span class="math">字</span>')
    createSheet([
      '.mf-preview-content .math { font-family: MathFont; }',
      `@font-face { font-family: MathFont; src: url("${source}") format("woff2"); }`,
    ])
    vi.mocked(invoke).mockResolvedValue({ code: FileResultCode.Success, content: fontBase64 })
    const fetcher = vi.fn(async () => ({ ok: true, arrayBuffer: async () => fontBytes.buffer }))
    vi.stubGlobal('fetch', fetcher)
    const { html } = await prepare(root)
    expect(html).toContain(fontData)
    if (source.startsWith('blob:')) expect(fetcher).toHaveBeenCalledExactlyOnceWith(source)
    else
      expect(invoke).toHaveBeenCalledExactlyOnceWith('read_u8_array_from_file', {
        filePath: '/notes/font.woff2',
      })
  })

  it('retains inline font faces and already embedded images', async () => {
    const root = createRoot(
      `<style>@font-face{font-family:Inline;src:url("${fontData}")} .mf-preview-content h1{font-family:Inline}</style><h1>字体</h1><img src="${png}">`,
    )
    const { html } = await prepare(root)
    expect(html).toContain(fontData)
    expect(parse(html).querySelector('img')?.getAttribute('src')).toBe(png)
    expect(getExportableImageSrc).toHaveBeenCalledWith(png, undefined, png)
  })

  it.each([
    'https://external.invalid/font.woff2',
    'asset://localhost/%2Fnotes%2Fmissing.woff2',
    'blob:bad-font',
  ])('rejects unavailable or invalid font %s without a successful snapshot', async (source) => {
    const root = createRoot('<span class="math">字</span>')
    createSheet([
      '.mf-preview-content .math { font-family: MathFont; }',
      `@font-face { font-family: MathFont; src: url("${source}"); }`,
    ])
    vi.mocked(invoke).mockResolvedValue({ code: FileResultCode.NotFound, content: 'missing' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode('<html>404</html>').buffer,
      })),
    )
    const before = root.outerHTML
    await expect(prepare(root)).rejects.toThrow(/font/i)
    expect(root.outerHTML).toBe(before)
  })

  it('retains an inherited theme variable with an embedded CSS image', async () => {
    const root = createRoot('<h1>主题</h1>')
    const preview = root.querySelector<HTMLElement>('.mf-preview-content')!
    preview.style.setProperty('--document-ink', 'rgb(10, 20, 30)')
    preview.style.setProperty('--document-image', 'url("asset://localhost/%2Fnotes%2Ficon.png")')
    createSheet([
      '.mf-preview-content h1 { color: var(--document-ink); background-image: var(--document-image); }',
    ])
    vi.mocked(getExportableImageSrc).mockResolvedValue(png)
    const { html } = await prepare(root, { fileFolderPath: '/notes' })
    expect(html).toContain('--document-ink')
    expect(html).toContain('rgb(10, 20, 30)')
    expect(html).toContain(png)
    expect(html).not.toContain('asset://')
  })
})
