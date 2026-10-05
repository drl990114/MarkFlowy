import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Buffer } from 'node:buffer'
import { parse, defaultTreeAdapter as tree, type DefaultTreeAdapterTypes } from 'parse5'
import {
  HTML_PREVIEW_CSP,
  HTML_PREVIEW_SANDBOX,
  HTML_PREVIEW_TRUSTED_SANDBOX,
  prepareHtmlPreview,
  previewFileUrl,
} from './htmlPreviewDocument'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke }))

beforeEach(() => {
  invoke.mockReset()
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    throw new Error('Host Blob URLs cannot be loaded by the opaque preview frame')
  })
})
afterEach(() => vi.restoreAllMocks())

const controller = () => new AbortController()
const encode = (value: string) => new TextEncoder().encode(value)
const elements = (source: string, tag: string) => {
  const found: DefaultTreeAdapterTypes.Element[] = []
  const visit = (parent: DefaultTreeAdapterTypes.ParentNode) => {
    for (const node of parent.childNodes) {
      if (!tree.isElementNode(node)) continue
      if (node.tagName === tag) found.push(node)
      visit(node)
    }
  }
  visit(parse(source))
  return found
}
const attribute = (node: DefaultTreeAdapterTypes.Element, name: string) =>
  node.attrs.find((attr) => attr.name === name)?.value ?? ''
const decode = (url: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(url.split(',')[1].split('#')[0]), (character) => character.charCodeAt(0)),
  )

describe('isolated HTML preview documents', () => {
  it('keeps page styles and scripts inside an opaque sandbox with restrictive resource policy', async () => {
    const source =
      '<!doctype html><html><head><title>Demo</title><style>body{color:red}</style></head><body><button onclick="this.textContent=1">Click</button><script>window.answer=42</script><base href="file:///"/><meta http-equiv="refresh" content="0;url=file:///secret"/><iframe src="file:///secret"></iframe><a href="https://example.com">Link</a></body></html>'
    const reader = vi.fn()
    const preview = await prepareHtmlPreview(
      source,
      '/site/index.html',
      controller().signal,
      reader,
    )
    expect(HTML_PREVIEW_SANDBOX).toBe('')
    expect(HTML_PREVIEW_TRUSTED_SANDBOX).toBe('allow-scripts')
    expect(HTML_PREVIEW_CSP).toContain("connect-src 'none'")
    expect(HTML_PREVIEW_CSP).toContain("style-src 'unsafe-inline' blob: data:")
    expect(HTML_PREVIEW_CSP).toContain("script-src 'unsafe-inline' blob: data:")
    expect(HTML_PREVIEW_CSP).not.toMatch(/(?:script|style|img|font|media)-src[^;]*https:/)
    expect(preview.html).toContain('window.answer=42')
    expect(preview.html).toContain('onclick="this.textContent=1"')
    expect(preview.html).toContain('Content-Security-Policy')
    expect(HTML_PREVIEW_CSP).toContain("frame-src 'none'")
    expect(preview.html).not.toContain('<base')
    expect(preview.html).not.toContain('<iframe')
    expect(preview.html).not.toContain('http-equiv="refresh"')
    expect(preview.html).not.toContain('href="https://example.com"')
    expect(reader).not.toHaveBeenCalled()
    preview.dispose()
  })

  it('resolves nested CSS imports, images, fonts and scripts without changing source', async () => {
    const source =
      '<link rel="stylesheet" href="css/main.css"><img src="图片%20a.png"><script src="app.js"></script>'
    const files: Record<string, string> = {
      '/site/css/main.css': '@import "nested.css"; body{background:url(../图片%20a.png)}',
      '/site/css/nested.css': '@font-face{src:url(../font.woff2)}',
      '/site/图片 a.png': 'image',
      '/site/font.woff2': 'font',
      '/site/app.js': 'alert(1)',
    }
    const reader = vi.fn(async (_documentPath: string, path: string) => {
      if (!(path in files)) throw new Error('missing')
      return encode(files[path])
    })
    const preview = await prepareHtmlPreview(
      source,
      '/site/index.html',
      controller().signal,
      reader,
    )
    expect(preview.blockedResources).toBe(0)
    expect(reader).toHaveBeenCalledWith('/site/index.html', '/site/图片 a.png')
    expect(reader).toHaveBeenCalledTimes(5)
    expect(preview.html).not.toContain('href="css/main.css"')
    const sheet = decode(attribute(elements(preview.html, 'link')[0], 'href'))
    expect(sheet).not.toContain('url(../')
    expect(sheet).toContain('data:image/png;base64,aW1hZ2U=')
    const imported = sheet.match(/@import "([^"]+)"/)![1]
    expect(decode(imported)).toContain('data:font/woff2;base64,Zm9udA==')
    expect(decode(attribute(elements(preview.html, 'script')[0], 'src'))).toBe('alert(1)')
    expect(source).toContain('css/main.css')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    preview.dispose()
  })

  it('blocks traversal, native protocols, local modules, missing resources and cyclic imports', async () => {
    const reader = vi.fn(async (_documentPath: string, path: string) => {
      if (path.endsWith('main.css')) return encode('@import "main.css";')
      throw new Error('native path check denied symlink or missing file')
    })
    const preview = await prepareHtmlPreview(
      '<img src="../secret"><img src="asset://localhost/secret"><img src="escape.png"><script type="module" src="local.mjs"></script><link rel="stylesheet" href="main.css">',
      '/site/index.html',
      controller().signal,
      reader,
    )
    expect(reader).toHaveBeenCalledTimes(2)
    expect(preview.blockedResources).toBe(5)
    expect(preview.html).not.toContain('type="module"')
    preview.dispose()
  })

  it('blocks remote resources while retaining inline data images without native reads', async () => {
    const reader = vi.fn()
    const preview = await prepareHtmlPreview(
      '<img src="https://example.com/a%20b?key=a%2Fb"><img src="data:image/png;base64,YQ==">',
      undefined,
      controller().signal,
      reader,
    )
    expect(preview.html).not.toContain('https://example.com/a%20b?key=a%2Fb')
    expect(preview.html).toContain('src="data:,"')
    expect(preview.html).toContain('src="data:image/png;base64,YQ=="')
    expect(preview.blockedResources).toBe(1)
    expect(reader).not.toHaveBeenCalled()
    preview.dispose()
  })

  it('cancels pending work on refresh or close without allocating host Blob URLs', async () => {
    const cancellation = controller()
    let resolveRead!: (value: Uint8Array<ArrayBuffer>) => void
    const reader = vi.fn((_doc: string, path: string) =>
      path.endsWith('a.png')
        ? Promise.resolve(encode('a'))
        : new Promise<Uint8Array<ArrayBuffer>>((resolve) => {
            resolveRead = resolve
          }),
    )
    const pending = prepareHtmlPreview(
      '<img src="a.png"><img src="b.png">',
      '/site/index.html',
      cancellation.signal,
      reader,
    )
    await vi.waitFor(() => expect(reader).toHaveBeenCalledTimes(2))
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    cancellation.abort()
    resolveRead(encode('b'))
    await expect(pending).rejects.toThrow()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('preserves JPG/SVG bytes, MIME types, fragments and encoded filenames', async () => {
    const jpeg = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70])
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>中文</text></svg>'
    const reader = vi.fn(async (_doc: string, path: string) =>
      path.endsWith('.JPG') ? jpeg : encode(svg),
    )
    const preview = await prepareHtmlPreview(
      '<img src="图片%20%231%25.JPG?v=1"><img src="logo.svg#view"><img srcset="图片%20%231%25.JPG 1x, logo.svg 2x">',
      '/site/index.html',
      controller().signal,
      reader,
    )
    const images = elements(preview.html, 'img')
    expect(attribute(images[0], 'src')).toBe(
      `data:image/jpeg;base64,${btoa(String.fromCharCode(...jpeg))}`,
    )
    expect(attribute(images[1], 'src')).toBe(
      `data:image/svg+xml;base64,${btoa(String.fromCharCode(...encode(svg)))}#view`,
    )
    expect(attribute(images[2], 'srcset')).toContain('data:image/jpeg;base64,')
    expect(attribute(images[2], 'srcset')).toContain(' 1x, data:image/svg+xml;base64,')
    expect(attribute(images[2], 'srcset')).toContain(' 2x')
    expect(reader).toHaveBeenCalledWith('/site/index.html', '/site/图片 #1%.JPG')
    expect(reader).toHaveBeenCalledTimes(2)
    expect(preview.resourceIssues).toEqual([])
    preview.dispose()
  })

  it('preserves binary resources across base64 encoding chunks', async () => {
    const bytes = Uint8Array.from({ length: 160_001 }, (_, index) => index % 256)
    const preview = await prepareHtmlPreview(
      '<img src="photo.jpg">',
      '/site/index.html',
      controller().signal,
      async () => bytes,
    )
    const url = attribute(elements(preview.html, 'img')[0], 'src')
    expect(Buffer.from(url.split(',')[1], 'base64')).toEqual(Buffer.from(bytes))
    expect(preview.resourceIssues).toEqual([])
    preview.dispose()
  })

  it('resolves sibling assets inside the owning workspace, including CSS-relative dependencies', async () => {
    const reader = vi.fn(async (_doc: string, path: string) => {
      if (path === '/site/css/main.css') return encode('body{background:url(../assets/photo.jpg)}')
      if (path === '/site/assets/photo.jpg') return encode('photo')
      throw new Error(`Unexpected path: ${path}`)
    })
    const preview = await prepareHtmlPreview(
      '<link rel="stylesheet" href="../css/main.css" media="screen" integrity="old" crossorigin="anonymous"><img src="../assets/photo.jpg">',
      '/site/pages/index.html',
      controller().signal,
      reader,
      { workspacePath: '/site' },
    )
    const link = elements(preview.html, 'link')[0]
    expect(attribute(link, 'media')).toBe('screen')
    expect(attribute(link, 'integrity')).toBe('')
    expect(attribute(link, 'crossorigin')).toBe('')
    expect(decode(attribute(link, 'href'))).toContain('data:image/jpeg;base64,cGhvdG8=')
    expect(reader).toHaveBeenCalledTimes(2)
    expect(preview.blockedResources).toBe(0)
    preview.dispose()
  })

  it.each([undefined, '/unrelated'])(
    'does not borrow an unrelated workspace (%s)',
    async (workspacePath) => {
      const reader = vi.fn()
      const preview = await prepareHtmlPreview(
        '<img src="../assets/photo.jpg">',
        '/site/pages/index.html',
        controller().signal,
        reader,
        { workspacePath },
      )
      expect(reader).not.toHaveBeenCalled()
      expect(preview.resourceIssues).toEqual([
        { reference: '../assets/photo.jpg', reason: 'outside_root' },
      ])
      preview.dispose()
    },
  )

  it('keeps workspace boundaries at path segments and supports Windows path aliases', async () => {
    const reader = vi.fn(async () => encode('image'))
    const preview = await prepareHtmlPreview(
      '<img src="../assets/photo.jpg"><img src="../../site-other/secret.jpg">',
      'C:\\Site\\pages\\index.html',
      controller().signal,
      reader,
      { workspacePath: 'c:\\site' },
    )
    expect(reader).toHaveBeenCalledTimes(1)
    expect(reader).toHaveBeenCalledWith('C:\\Site\\pages\\index.html', 'C:/Site/assets/photo.jpg')
    expect(preview.resourceIssues).toEqual([
      { reference: '../../site-other/secret.jpg', reason: 'outside_root' },
    ])
    preview.dispose()
  })

  it('surfaces native permission, missing-file and symlink failures while loading other assets', async () => {
    invoke
      .mockRejectedValueOnce({ code: 'permission_denied' })
      .mockRejectedValueOnce({ code: 'not_found' })
      .mockRejectedValueOnce({ code: 'outside_root' })
      .mockResolvedValueOnce({ content: btoa('image') })
    const preview = await prepareHtmlPreview(
      '<img src="denied.jpg"><img src="missing.jpg"><img src="link.jpg"><img src="ok.jpg">',
      '/site/index.html',
      controller().signal,
    )
    expect(invoke).toHaveBeenCalledWith('read_html_preview_resource', {
      documentPath: '/site/index.html',
      resourcePath: '/site/ok.jpg',
    })
    expect(preview.resourceIssues.map(({ reason }) => reason)).toEqual([
      'permission_denied',
      'not_found',
      'outside_root',
    ])
    expect(attribute(elements(preview.html, 'img')[3], 'src')).toBe(
      'data:image/jpeg;base64,aW1hZ2U=',
    )
    preview.dispose()
  })

  it('bounds repeated data URL expansion even when only one resource is read', async () => {
    const reader = vi.fn(async (_doc: string, path: string) =>
      path.endsWith('large.jpg') ? encode('x'.repeat(900)) : encode('ok'),
    )
    const preview = await prepareHtmlPreview(
      '<img src="large.jpg">'.repeat(8) + '<img src="small.jpg">',
      '/site/index.html',
      controller().signal,
      reader,
      { maxExpandedBytes: 6000 },
    )
    expect(reader).toHaveBeenCalledTimes(2)
    expect(preview.resourceIssues.length).toBeGreaterThan(0)
    expect(preview.resourceIssues.every(({ reason }) => reason === 'too_large')).toBe(true)
    expect(preview.html.length).toBeLessThan(6000)
    expect(attribute(elements(preview.html, 'img').at(-1)!, 'src')).toBe(
      'data:image/jpeg;base64,b2s=',
    )
    preview.dispose()
  })

  it('bounds nested CSS expansion and reports malformed CSS separately', async () => {
    const reader = vi.fn(async (_doc: string, path: string) => {
      if (path.endsWith('main.css')) return encode('a{background:url(large.jpg)}'.repeat(10))
      if (path.endsWith('bad.css')) return encode('a { color:')
      return encode('x'.repeat(900))
    })
    const preview = await prepareHtmlPreview(
      '<link rel="stylesheet" href="main.css"><link rel="stylesheet" href="bad.css">',
      '/site/index.html',
      controller().signal,
      reader,
      { maxExpandedBytes: 8000 },
    )
    expect(preview.resourceIssues.some(({ reason }) => reason === 'too_large')).toBe(true)
    expect(preview.resourceIssues.some(({ reason }) => reason === 'invalid_css')).toBe(true)
    expect(
      elements(preview.html, 'link').every((node) => attribute(node, 'href') === 'data:,'),
    ).toBe(true)
    preview.dispose()
  })

  it('encodes local filename characters before native path decoding', () => {
    expect(previewFileUrl('/site/中文 #1%.html').href).toBe(
      'file:///site/%E4%B8%AD%E6%96%87%20%231%25.html',
    )
    expect(previewFileUrl('C:\\site\\index.html').pathname).toBe('/C%3A/site/index.html')
  })
})
