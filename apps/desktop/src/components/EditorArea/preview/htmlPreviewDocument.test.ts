import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HTML_PREVIEW_CSP,
  HTML_PREVIEW_SANDBOX,
  prepareHtmlPreview,
  previewFileUrl,
} from './htmlPreviewDocument'

const blobs = new Map<string, Blob>()
let sequence = 0
beforeEach(() => {
  blobs.clear()
  sequence = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:preview-${++sequence}`
    blobs.set(url, blob as Blob)
    return url
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    blobs.delete(url)
  })
})
afterEach(() => vi.restoreAllMocks())

const controller = () => new AbortController()
const encode = (value: string) => new TextEncoder().encode(value)

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
    expect(HTML_PREVIEW_SANDBOX).toBe('allow-scripts')
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
    const sheets = await Promise.all(
      [...blobs.values()].filter((blob) => blob.type === 'text/css').map((blob) => blob.text()),
    )
    expect(sheets.join('\n')).not.toContain('url(../')
    expect(sheets.join('\n')).toContain('blob:preview-')
    expect(source).toContain('css/main.css')
    preview.dispose()
    expect(blobs.size).toBe(0)
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

  it('retains HTTPS URLs and inline data images without native reads', async () => {
    const reader = vi.fn()
    const preview = await prepareHtmlPreview(
      '<img src="https://example.com/a%20b?key=a%2Fb"><img src="data:image/png;base64,YQ==">',
      undefined,
      controller().signal,
      reader,
    )
    expect(preview.html).toContain('https://example.com/a%20b?key=a%2Fb')
    expect(reader).not.toHaveBeenCalled()
    preview.dispose()
  })

  it('cancels pending work and revokes partial resources on refresh or close', async () => {
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
    expect(blobs.size).toBe(1)
    cancellation.abort()
    resolveRead(encode('b'))
    await expect(pending).rejects.toThrow()
    expect(blobs.size).toBe(0)
  })

  it('encodes local filename characters before native path decoding', () => {
    expect(previewFileUrl('/site/中文 #1%.html').href).toBe(
      'file:///site/%E4%B8%AD%E6%96%87%20%231%25.html',
    )
    expect(previewFileUrl('C:\\site\\index.html').pathname).toBe('/C%3A/site/index.html')
  })
})
