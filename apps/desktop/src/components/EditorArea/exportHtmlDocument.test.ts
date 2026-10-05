import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getExportableImageSrc } from '@/helper/image'
import { exportHtmlDocument } from './exportHtmlDocument'

vi.mock('@/helper/image', () => ({ getExportableImageSrc: vi.fn() }))
const png = 'data:image/png;base64,iVBORw0KGgo='
const svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L2 2"/></svg>')}`

beforeEach(() => {
  vi.mocked(getExportableImageSrc).mockImplementation(async (source) => source)
})
afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('escapes metadata and preserves literal document text', async () => {
  const content = '<pre>const text = "a\\"b"</pre>'
  const html = await exportHtmlDocument(content, null, '<notes & "quotes">')
  expect(html).toContain(content)
  expect(html).toContain('&lt;notes &amp; &quot;quotes&quot;&gt;')
  expect(html).not.toContain('undefined')
})

it('embeds local PNG/SVG and SVG image resources while preserving same-document references', async () => {
  vi.mocked(getExportableImageSrc).mockImplementation(async (source) =>
    source.endsWith('.svg') ? svg : png,
  )
  const root = document.createElement('div')
  root.setAttribute('data-mf-image-export', 'true')
  root.setAttribute('inert', '')
  root.setAttribute('aria-hidden', 'true')
  root.style.cssText = 'position:absolute;left:-100000px;pointer-events:none;color:rgb(1, 2, 3)'
  root.innerHTML = `<img src="asset://localhost/sample.png" data-rme-original-src="/notes/sample.png" data-mf-preview-image-source="%2Fnotes%2Fsample.png" loading="lazy" srcset="/notes/sample@2x.png 2x">
<img src="asset://localhost/sample.svg"><svg><defs><path id="mark"/></defs><use href="${document.URL}#mark"/><image href="/notes/sample.png" xlink:href="/notes/sample.png" xmlns:xlink="http://www.w3.org/1999/xlink"/></svg>
<div style="mask:url(#mark)">Visible</div><button class="cm-copy-btn">Copy</button><button>Document button</button>`
  document.body.append(root)
  const before = root.outerHTML
  const html = await exportHtmlDocument(root.innerHTML, root, 'Images', '/notes')
  const exported = new DOMParser().parseFromString(html, 'text/html')
  expect([...exported.querySelectorAll('img')].map((image) => image.getAttribute('src'))).toEqual([
    png,
    svg,
  ])
  expect(exported.querySelector('svg image')?.getAttribute('href')).toBe(png)
  expect(
    exported.querySelector('svg image')?.getAttributeNS('http://www.w3.org/1999/xlink', 'href'),
  ).toBe(png)
  expect(exported.querySelector('use')?.getAttribute('href')).toBe('#mark')
  expect(html).toContain('url(&quot;#mark&quot;)')
  expect(html).not.toMatch(
    /asset:\/\/|\/notes\/|data-mf-preview-|data-rme-original-src|inert|aria-hidden|srcset|loading=|-100000px|cm-copy-btn/,
  )
  expect(exported.querySelector('button')?.textContent).toBe('Document button')
  expect(exported.querySelector('.mf-html-export')?.getAttribute('style')).toContain(
    'color: rgb(1, 2, 3)',
  )
  expect(root.outerHTML).toBe(before)
})

it('embeds a retained remote blob without fetching the original URL again', async () => {
  const fetch = vi.fn(async () => ({
    ok: true,
    blob: async () => new Blob(['image'], { type: 'image/png' }),
  }))
  vi.stubGlobal('fetch', fetch)
  const html = await exportHtmlDocument(
    '<img src="blob:retained" data-rme-original-src="https://example.com/private.png">',
    null,
    'Blob',
  )
  expect(getExportableImageSrc).toHaveBeenCalledWith('blob:retained', undefined, 'blob:retained')
  expect(fetch).toHaveBeenCalledWith('blob:retained')
  expect(html).toContain('data:image/png;base64,aW1hZ2U=')
  expect(html).not.toMatch(/blob:|example.com/)
})

it.each([
  '<img src="asset://localhost/missing.png">',
  '<svg><use href="/external.svg#symbol"/></svg>',
  `<img src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><image href="external.png"/></svg>')}">`,
  `<img src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><style>@font-face{src:url(font.woff2)}</style></svg>')}">`,
])('rejects unavailable or non-portable resources without mutating the source', async (content) => {
  const root = document.createElement('div')
  root.innerHTML = content
  const before = root.outerHTML
  await expect(exportHtmlDocument(root.innerHTML, root, 'Failure')).rejects.toThrow()
  expect(root.outerHTML).toBe(before)
})

it('uses unique Github anchors for Chinese, punctuation, emoji and collisions, preserving explicit IDs', async () => {
  const content =
    '<h1>中文标题</h1><h2>Hi, world! ✨</h2><h2>a</h2><h2>a</h2><h2>a-1</h2><h2 id="heading-5">自定义</h2><a href="#中文标题">Jump</a>'
  const html = await exportHtmlDocument(content, null, 'Anchors')
  const exported = new DOMParser().parseFromString(html, 'text/html')
  expect([...exported.querySelectorAll('h1,h2')].map((heading) => heading.id)).toEqual([
    '中文标题',
    'hi-world-',
    'a',
    'a-1',
    'a-1-1',
    'heading-5',
  ])
  expect(exported.querySelector('#heading-5 > span')?.id).toBe('自定义')
  expect(exported.getElementById(exported.querySelector('a')!.hash.slice(1))).not.toBeNull()
})
